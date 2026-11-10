-- Load-Bearing storage.
-- One row per analysis. The whole claim list lives in `payload` so the
-- schema can evolve without a migration for every field.
--
-- Plans are not stored by default: nothing is written unless the user ticks
-- "keep this analysis", and the delete button removes the row outright.

create table if not exists public.analyses (
  id          text primary key,
  title       text not null,
  summary     text not null default '',
  created_at  timestamptz not null default now(),
  payload     jsonb not null
);

create index if not exists analyses_created_at_idx on public.analyses (created_at desc);

-- The app talks to this table only from the server, with a secret key.
-- With RLS on and no policies, the anon and authenticated roles get nothing.
alter table public.analyses enable row level security;

comment on table public.analyses is
  'Load-Bearing analyses. Written and read server-side only; no client policies by design.';
