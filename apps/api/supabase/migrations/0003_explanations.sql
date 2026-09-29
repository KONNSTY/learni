-- Erklaerungs-Cache: Erklaerungen werden je (Lernsprache, UI-Sprache, Item) einmal erzeugt und wiederverwendet.
-- Enthaelt keine personenbezogenen Daten; Mock-Ausgaben werden nie gespeichert.
create table public.explanations (
  language text not null references public.languages(code),
  ui_language text not null check (ui_language in ('de','en')),
  item_id text not null,
  text text not null check (char_length(text) <= 600),
  model text,
  created_at timestamptz not null default now(),
  primary key (language, ui_language, item_id)
);
alter table public.explanations enable row level security;
alter table public.explanations force row level security;
create policy explanations_read on public.explanations for select to authenticated using (true);
revoke all on public.explanations from anon, authenticated;
grant select on public.explanations to authenticated;
grant all on public.explanations to service_role;
