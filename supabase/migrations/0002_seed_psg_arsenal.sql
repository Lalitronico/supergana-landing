-- Seed: PSG vs Arsenal - Champions League Final 2026.
-- Safe to re-run. Does not touch existing submissions.

insert into public.quinielas (
  slug,
  title,
  subtitle,
  event_name,
  venue,
  event_date,
  closes_at,
  status,
  theme,
  questions
)
values (
  'psg-arsenal',
  'PSG vs Arsenal',
  'Final Champions 2026',
  'Final UEFA Champions League',
  'Puskás Aréna, Budapest',
  '2026-05-30T18:00:00+02:00',
  '2026-05-30T17:00:00-06:00',
  'open',
  $json$
  {
    "teams": {
      "home": { "id": "psg", "label": "PSG", "color": "#004170" },
      "away": { "id": "arsenal", "label": "Arsenal", "color": "#EF0107" }
    },
    "style": "Supergana arcade cartoon"
  }
  $json$::jsonb,
  $json$
  [
    {"id":"q01_campeon","type":"team-duel","points":120},
    {"id":"q02_marcador_90","type":"score-picker","points":120},
    {"id":"q03_primer_gol","type":"team-duel","points":80},
    {"id":"q04_primer_goleador","type":"player-card","points":80},
    {"id":"q05_amarillas","type":"range-choice","points":70},
    {"id":"q06_penal","type":"yes-no","points":60},
    {"id":"q07_tiempo_extra","type":"yes-no","points":70},
    {"id":"q08_mvp","type":"player-card","points":90},
    {"id":"q09_celebracion_exagerada","type":"choice","points":70},
    {"id":"q10_baile","type":"yes-no","points":60},
    {"id":"q11_dt_corajes","type":"choice","points":70},
    {"id":"q12_var_drama","type":"drama-meter","points":70},
    {"id":"q13_main_character","type":"choice","points":40},
    {"id":"q14_tiebreaker","type":"time-tiebreaker","points":0}
  ]
  $json$::jsonb
)
on conflict (slug) do update
set title = excluded.title,
    subtitle = excluded.subtitle,
    event_name = excluded.event_name,
    venue = excluded.venue,
    event_date = excluded.event_date,
    closes_at = excluded.closes_at,
    status = excluded.status,
    theme = excluded.theme,
    questions = excluded.questions,
    updated_at = now();
