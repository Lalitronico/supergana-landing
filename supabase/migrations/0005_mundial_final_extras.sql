-- Real results for the final's extra questions (top scorer, final star, how
-- the final ended). Shape: { "topScorer": "messi", "star": "mbappe",
-- "ending": "pens" }. Used as deeper tiebreakers for the final prize.
alter table public.mundial_results
  add column if not exists final_extras jsonb not null default '{}'::jsonb;

comment on column public.mundial_results.final_extras is
  'Resultados reales de las preguntas extra de la final: {topScorer, star, ending}.';
