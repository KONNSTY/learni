"""RLS-Tests gegen ein echtes, temporaeres PostgreSQL (kein Mock). Nutzer A sieht nie Daten von Nutzer B."""
import os
import re
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path

import pytest

psycopg = pytest.importorskip("psycopg")
PG_BIN = next((p for p in Path("/usr/lib/postgresql").glob("*/bin")), None)
pytestmark = pytest.mark.skipif(PG_BIN is None, reason="PostgreSQL nicht installiert")
MIG = Path(__file__).resolve().parents[1] / "supabase"

HARNESS = """
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;
"""


def _run(*args, user="postgres"):
    if os.geteuid() == 0:
        args = ("runuser", "-u", user, "--", *args)
    return subprocess.run(args, check=True, capture_output=True, text=True)


@pytest.fixture(scope="module")
def db():
    base = Path(tempfile.mkdtemp(prefix="learni_pg_"))
    os.chmod(base, 0o755)
    if os.geteuid() == 0:
        shutil.chown(base, "postgres", "postgres")
    data, sock = base / "data", base / "sock"
    sock.mkdir()
    if os.geteuid() == 0:
        shutil.chown(sock, "postgres", "postgres")
    _run(str(PG_BIN / "initdb"), "-D", str(data), "-A", "trust", "-U", "postgres")
    _run(str(PG_BIN / "pg_ctl"), "-D", str(data), "-o", f"-k {sock} -c listen_addresses='' -c fsync=off", "-w", "-l", str(base / "log"), "start")
    conn = psycopg.connect(host=str(sock), user="postgres", dbname="postgres", autocommit=True)
    conn.execute(HARNESS)
    for f in ("migrations/0001_schema.sql", "migrations/0002_rls.sql", "seed.sql"):
        conn.execute((MIG / f).read_text())
    yield conn
    conn.close()
    _run(str(PG_BIN / "pg_ctl"), "-D", str(data), "-m", "immediate", "stop")
    shutil.rmtree(base, ignore_errors=True)


@pytest.fixture
def users(db):
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    db.execute("reset role")
    for u in (a, b):
        db.execute("insert into auth.users(id) values (%s)", (u,))
        db.execute("insert into public.profiles(user_id, display_name) values (%s, %s)", (u, "user-" + u[:4]))
        db.execute("insert into public.memberships(user_id) values (%s)", (u,))
        db.execute("insert into public.learner_state(user_id, language) values (%s, 'es')", (u,))
        db.execute("insert into public.item_states(user_id, language, item_id) values (%s, 'es', 'es.hola')", (u,))
        db.execute("insert into public.tutor_profiles(user_id, language) values (%s, 'es')", (u,))
        db.execute("insert into public.usage_daily(user_id, day) values (%s, current_date)", (u,))
        db.execute("insert into public.issued_exercises values (%s, 'ex1', 'es', 'flashcard', 'es.hola', 'vocabulary', false, null, now())", (u,))
        db.execute("insert into public.analytics_events(user_id, name) values (%s, 'app_open')", (u,))
    return a, b


def as_user(db, uid):
    db.execute("reset role")
    db.execute("set role authenticated")
    db.execute("select set_config('request.jwt.claim.sub', %s, false)", (uid,))


def as_anon(db):
    db.execute("reset role")
    db.execute("set role anon")
    db.execute("select set_config('request.jwt.claim.sub', '', false)")


def test_every_public_table_has_rls_enabled_and_forced(db):
    db.execute("reset role")
    rows = db.execute("select relname, relrowsecurity, relforcerowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'").fetchall()
    assert len(rows) >= 11
    assert [r[0] for r in rows if not (r[1] and r[2])] == []


def test_sql_files_cover_every_created_table():
    schema = (MIG / "migrations/0001_schema.sql").read_text()
    rls = (MIG / "migrations/0002_rls.sql").read_text()
    tables = re.findall(r"create table public\.(\w+)", schema)
    assert tables and all(f"alter table public.{t} enable row level security" in rls for t in tables)


@pytest.mark.parametrize("table", ["profiles", "memberships", "learner_state", "item_states", "tutor_profiles", "usage_daily"])
def test_user_sees_only_own_rows(db, users, table):
    a, b = users
    as_user(db, a)
    ids = {r[0] for r in db.execute(f"select user_id::text from public.{table}").fetchall()}
    assert ids == {a}
    as_user(db, b)
    assert {r[0] for r in db.execute(f"select user_id::text from public.{table}").fetchall()} == {b}


@pytest.mark.parametrize("table", ["issued_exercises", "analytics_events"])
def test_backend_only_tables_are_locked(db, users, table):
    a, _ = users
    as_user(db, a)
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        db.execute(f"select * from public.{table}")


def test_cannot_update_or_delete_others_profile(db, users):
    a, b = users
    as_user(db, a)
    assert db.execute("update public.profiles set display_name = 'hacked' where user_id = %s", (b,)).rowcount == 0
    assert db.execute("delete from public.profiles where user_id = %s", (b,)).rowcount == 0
    assert db.execute("update public.profiles set display_name = 'mine' where user_id = %s", (a,)).rowcount == 1
    db.execute("reset role")
    assert db.execute("select display_name from public.profiles where user_id = %s", (b,)).fetchone()[0].startswith("user-")


def test_cannot_move_profile_to_other_user(db, users):
    a, b = users
    as_user(db, a)
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        db.execute("update public.profiles set user_id = %s where user_id = %s", (b, a))


def test_cannot_insert_profile_for_someone_else(db, users):
    a, _ = users
    as_user(db, a)
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        db.execute("insert into public.profiles(user_id) values (%s)", (str(uuid.uuid4()),))


@pytest.mark.parametrize("sql", [
    "update public.memberships set tier = 'pro' where user_id = %(a)s",
    "insert into public.memberships(user_id, tier) values (%(a)s, 'pro')",
    "update public.learner_state set xp = 999999, hearts = 99 where user_id = %(a)s",
    "insert into public.usage_daily(user_id, day) values (%(a)s, current_date + 1)",
    "delete from public.usage_daily where user_id = %(a)s",
    "update public.item_states set stability = 999 where user_id = %(a)s",
])
def test_client_cannot_write_server_owned_tables(db, users, sql):
    a, _ = users
    as_user(db, a)
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        db.execute(sql, {"a": a})


def test_tutor_profile_deletable_only_by_owner(db, users):
    a, b = users
    as_user(db, a)
    assert db.execute("delete from public.tutor_profiles where user_id = %s", (b,)).rowcount == 0
    assert db.execute("delete from public.tutor_profiles where user_id = %s", (a,)).rowcount == 1
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        db.execute("insert into public.tutor_profiles(user_id, language) values (%s, 'es')", (a,))


def test_anon_reads_languages_only(db, users):
    as_anon(db)
    assert db.execute("select count(*) from public.languages").fetchone()[0] == 6
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        db.execute("select * from public.profiles")
    db.execute("reset role")


def test_friendships_visibility_and_spoofing(db, users):
    a, b = users
    c = str(uuid.uuid4())
    db.execute("reset role")
    db.execute("insert into auth.users(id) values (%s)", (c,))
    db.execute("insert into public.friendships(user_id, friend_id) values (%s, %s)", (a, b))
    as_user(db, c)
    assert db.execute("select count(*) from public.friendships").fetchone()[0] == 0
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        db.execute("insert into public.friendships(user_id, friend_id) values (%s, %s)", (a, c))  # im Namen von A
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        db.execute("insert into public.friendships(user_id, friend_id, status) values (%s, %s, 'accepted')", (c, a))  # sich selbst annehmen
    as_user(db, b)
    assert db.execute("select count(*) from public.friendships").fetchone()[0] == 1


def test_service_role_bypasses_and_account_delete_cascades(db, users):
    a, b = users
    db.execute("reset role")
    db.execute("set role service_role")
    assert db.execute("select count(*) from public.profiles").fetchone()[0] >= 2
    db.execute("reset role")
    db.execute("delete from auth.users where id = %s", (a,))
    for t in ("profiles", "memberships", "learner_state", "item_states", "tutor_profiles", "usage_daily", "issued_exercises", "analytics_events"):
        assert db.execute(f"select count(*) from public.{t} where user_id = %s", (a,)).fetchone()[0] == 0, t
    assert db.execute("select count(*) from public.profiles where user_id = %s", (b,)).fetchone()[0] == 1
