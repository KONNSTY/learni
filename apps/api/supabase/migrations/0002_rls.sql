-- Row Level Security auf ALLEN Tabellen, ohne Ausnahme.
-- Grundsatz: Clients duerfen nur eigene Zeilen LESEN. Schreibzugriffe auf Lernstand, Mitgliedschaft,
-- Budget und Tutor-Profil laufen ausschliesslich ueber das Backend (service_role umgeht RLS).
-- So kann sich niemand selbst Pro, XP oder Herzen geben.

alter table public.languages enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.learner_state enable row level security;
alter table public.item_states enable row level security;
alter table public.tutor_profiles enable row level security;
alter table public.usage_daily enable row level security;
alter table public.issued_exercises enable row level security;
alter table public.analytics_events enable row level security;
alter table public.league_entries enable row level security;
alter table public.friendships enable row level security;

alter table public.languages force row level security;
alter table public.profiles force row level security;
alter table public.memberships force row level security;
alter table public.learner_state force row level security;
alter table public.item_states force row level security;
alter table public.tutor_profiles force row level security;
alter table public.usage_daily force row level security;
alter table public.issued_exercises force row level security;
alter table public.analytics_events force row level security;
alter table public.league_entries force row level security;
alter table public.friendships force row level security;

-- Sprachen: oeffentlich lesbar (Auswahl vor Login)
create policy languages_read on public.languages for select to anon, authenticated using (enabled);

-- Profil: eigenes lesen/aendern (Einstellungen, Einwilligungen), loeschen ueber Konto-Loeschung
create policy profiles_select_own on public.profiles for select to authenticated using (user_id = (select auth.uid()));
create policy profiles_insert_own on public.profiles for insert to authenticated with check (user_id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy profiles_delete_own on public.profiles for delete to authenticated using (user_id = (select auth.uid()));

-- Nur lesen (Schreiben = Backend)
create policy memberships_select_own on public.memberships for select to authenticated using (user_id = (select auth.uid()));
create policy learner_state_select_own on public.learner_state for select to authenticated using (user_id = (select auth.uid()));
create policy item_states_select_own on public.item_states for select to authenticated using (user_id = (select auth.uid()));
create policy usage_daily_select_own on public.usage_daily for select to authenticated using (user_id = (select auth.uid()));
create policy league_entries_select_own on public.league_entries for select to authenticated using (user_id = (select auth.uid()));

-- KI-Profil: einsehbar UND loeschbar durch den Nutzer
create policy tutor_profiles_select_own on public.tutor_profiles for select to authenticated using (user_id = (select auth.uid()));
create policy tutor_profiles_delete_own on public.tutor_profiles for delete to authenticated using (user_id = (select auth.uid()));

-- Freunde: beteiligte Personen duerfen lesen; Anfragen stellt nur der Absender
create policy friendships_select_party on public.friendships for select to authenticated
  using (user_id = (select auth.uid()) or friend_id = (select auth.uid()));
create policy friendships_insert_sender on public.friendships for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');
create policy friendships_delete_party on public.friendships for delete to authenticated
  using (user_id = (select auth.uid()) or friend_id = (select auth.uid()));

-- issued_exercises und analytics_events: bewusst KEINE Policy = fuer anon/authenticated komplett gesperrt.

-- Rechte: Grundrechte auf das Minimum
revoke all on all tables in schema public from anon, authenticated;
grant select on public.languages to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select on public.memberships, public.learner_state, public.item_states, public.usage_daily, public.league_entries to authenticated;
grant select, delete on public.tutor_profiles to authenticated;
grant select, insert, delete on public.friendships to authenticated;
