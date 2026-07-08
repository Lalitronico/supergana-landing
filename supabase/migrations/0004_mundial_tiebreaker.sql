-- Per-stage tiebreaker: each stage's prize goes to the entrant(s) who hit the
-- stage AND land closest to the exact score of that stage's key match.
-- Shape: { "cuartos": {"home":2,"away":1}, "semis": {...}, "final": {...} }
alter table public.mundial_results
  add column if not exists tiebreaker_scores jsonb not null default '{}'::jsonb;

comment on column public.mundial_results.tiebreaker_scores is
  'Marcador real del partido clave de cada fase, para el desempate: {cuartos:{home,away},semis,final}.';
