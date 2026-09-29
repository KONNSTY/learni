-- Learni Schema v1. Jeder Nutzer hat vollstaendige Eintraege in diesen Tabellen.
-- Alle Tabellen bekommen in 0002_rls.sql Row Level Security.

create table public.languages (
  code text primary key,
  name text not null,
  native_name text not null,
  tier text not null check (tier in ('A','B','C')),
  badge text not null,
  region_variants text[] not null default '{}',
  enabled boolean not null default true
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  native_language text not null default 'de',
  ui_language text not null default 'de' check (ui_language in ('de','en')),
  age_bracket text check (age_bracket in ('under_16','16_17','18_plus')),
  avatar jsonb not null default '{"id":"placeholder","outfit":{}}',
  settings jsonb not null default '{}',
  consents jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null default 'free' check (tier in ('free','pro')),
  status text not null default 'active',
  trial boolean not null default false,
  expires_at timestamptz,
  source text not null default 'none',
  regional_tier text not null default 'tier1',
  product_id text
);

create table public.learner_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  language text not null references public.languages(code),
  level text not null default 'A1' check (level in ('A1','A2','B1','B2')),
  goal text not null default 'fun',
  daily_goal_minutes int not null default 10 check (daily_goal_minutes in (5,10,15,20)),
  daily_xp int not null default 0,
  daily_xp_day date,
  xp int not null default 0,
  streak_days int not null default 0,
  streak_last_active date,
  streak_freezes int not null default 0,
  hearts int not null default 5,
  hearts_refill_at timestamptz,
  trophies text[] not null default '{}',
  skills jsonb not null default '{"listening":0,"speaking":0,"vocabulary":0,"grammar":0}',
  lessons int not null default 0,
  seq int not null default 0,
  accuracy numeric not null default 1,
  recent_items text[] not null default '{}',
  mistakes jsonb not null default '{}',
  created_at timestamptz not null default now(),
  primary key (user_id, language)
);

create table public.item_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  language text not null references public.languages(code),
  item_id text not null,
  stability double precision not null default 0,
  difficulty double precision not null default 0,
  reps int not null default 0,
  lapses int not null default 0,
  last_review timestamptz,
  due timestamptz,
  primary key (user_id, language, item_id)
);
create index item_states_due_idx on public.item_states (user_id, language, due);

create table public.tutor_profiles (
  user_id uuid not null references auth.users(id) on delete cascade,
  language text not null references public.languages(code),
  goals text[] not null default '{}',
  interests text[] not null default '{}',
  typical_mistakes text[] not null default '{}',
  pace text not null default 'normal',
  preferences jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, language)
);

create table public.usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  ai_seconds int not null default 0,
  cost_cents numeric not null default 0,
  rewarded_ads int not null default 0,
  primary key (user_id, day)
);
create index usage_daily_day_idx on public.usage_daily (day);

create table public.issued_exercises (
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null,
  language text not null,
  type text not null,
  item_id text not null,
  skill text not null,
  decidable boolean not null,
  expected_answer jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

create table public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  language text,
  tier text,
  props jsonb not null default '{}',
  ts timestamptz not null default now()
);
create index analytics_events_name_ts_idx on public.analytics_events (name, ts);

-- Social-Datenmodell (nur Modell, Logik folgt spaeter)
create table public.league_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  week text not null,
  league text not null default 'bronze',
  weekly_xp int not null default 0,
  primary key (user_id, week)
);
create table public.friendships (
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
