-- Supergana quinielas - static frontend + Supabase RPC.
-- Run in Supabase SQL editor before seed migrations.

create extension if not exists pgcrypto;

create table if not exists public.quinielas (
  slug text primary key,
  title text not null,
  subtitle text not null,
  event_name text not null,
  venue text not null,
  event_date timestamptz not null,
  closes_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'closed', 'scored')),
  theme jsonb not null default '{}'::jsonb,
  questions jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  quiniela_slug text not null references public.quinielas(slug) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 32),
  email text not null,
  answers jsonb not null,
  provisional_score int not null default 0,
  final_score int,
  tiebreaker_distance int,
  share_id text not null default encode(gen_random_bytes(5), 'hex'),
  created_at timestamptz not null default now(),
  unique (quiniela_slug, email)
);

create table if not exists public.correct_answers (
  quiniela_slug text primary key references public.quinielas(slug) on delete cascade,
  answers jsonb not null,
  scored_at timestamptz not null default now()
);

create index if not exists submissions_provisional_idx
  on public.submissions (quiniela_slug, provisional_score desc, created_at asc);

create index if not exists submissions_final_idx
  on public.submissions (
    quiniela_slug,
    final_score desc nulls last,
    tiebreaker_distance asc nulls last,
    created_at asc
  );

create or replace view public.provisional_leaderboard_view as
select
  s.quiniela_slug,
  s.id as submission_id,
  s.nickname,
  s.provisional_score,
  s.final_score,
  s.created_at,
  rank() over (
    partition by s.quiniela_slug
    order by s.provisional_score desc, s.created_at asc
  ) as rank
from public.submissions s;

create or replace view public.final_leaderboard_view as
select
  s.quiniela_slug,
  s.id as submission_id,
  s.nickname,
  s.final_score,
  s.tiebreaker_distance,
  s.created_at,
  rank() over (
    partition by s.quiniela_slug
    order by s.final_score desc nulls last, s.tiebreaker_distance asc nulls last, s.created_at asc
  ) as rank
from public.submissions s
where s.final_score is not null;

alter table public.quinielas enable row level security;
alter table public.submissions enable row level security;
alter table public.correct_answers enable row level security;

drop policy if exists "anon can read quinielas" on public.quinielas;
create policy "anon can read quinielas"
  on public.quinielas for select
  to anon
  using (true);

-- No direct anon read/write to submissions. Public access goes through
-- security-definer RPC and public leaderboard views that exclude emails.
drop policy if exists "anon cannot read submissions directly" on public.submissions;
create policy "anon cannot read submissions directly"
  on public.submissions for select
  to anon
  using (false);

drop policy if exists "anon cannot insert submissions directly" on public.submissions;
create policy "anon cannot insert submissions directly"
  on public.submissions for insert
  to anon
  with check (false);

revoke all on public.correct_answers from anon, authenticated;
grant select on public.quinielas to anon;
grant select on public.provisional_leaderboard_view to anon;
grant select on public.final_leaderboard_view to anon;

create or replace function public.calculate_provisional_score(p_answers jsonb)
returns int
language plpgsql
immutable
as $$
declare
  v_score int := 620;
  v_home int;
  v_away int;
begin
  if p_answers ? 'q02_marcador_90' then
    v_home := coalesce((p_answers #>> '{q02_marcador_90,home}')::int, 0);
    v_away := coalesce((p_answers #>> '{q02_marcador_90,away}')::int, 0);
    if v_home + v_away >= 4 then v_score := v_score + 40; end if;
    if v_home + v_away = 0 then v_score := v_score + 22; end if;
  end if;

  if p_answers->>'q03_primer_gol' = 'none' then v_score := v_score + 30; end if;
  if p_answers->>'q05_amarillas' = '6+' then v_score := v_score + 35; end if;
  if p_answers->>'q06_penal' = 'yes' then v_score := v_score + 24; end if;
  if p_answers->>'q07_tiempo_extra' = 'yes' then v_score := v_score + 28; end if;
  if p_answers->>'q09_celebracion_exagerada' = 'ambos' then v_score := v_score + 40; end if;
  if p_answers->>'q10_baile' = 'yes' then v_score := v_score + 25; end if;
  if p_answers->>'q11_dt_corajes' = 'ambos' then v_score := v_score + 34; end if;
  if p_answers->>'q12_var_drama' = 'telenovela' then
    v_score := v_score + 62;
  elsif p_answers->>'q12_var_drama' = 'sospechoso' then
    v_score := v_score + 32;
  end if;
  if p_answers->>'q13_main_character' in ('arbitro', 'aficion') then
    v_score := v_score + 30;
  end if;

  return least(1000, v_score);
end;
$$;

create or replace function public.submit_quiniela(
  p_slug text,
  p_nickname text,
  p_email text,
  p_answers jsonb
)
returns table (
  submission_id uuid,
  share_id text,
  provisional_score int,
  provisional_rank bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quiz public.quinielas%rowtype;
  v_question jsonb;
  v_required int := 0;
  v_score int;
  v_submission public.submissions%rowtype;
begin
  select * into v_quiz from public.quinielas where slug = p_slug;
  if not found then
    raise exception 'Quiniela not found';
  end if;
  if v_quiz.status <> 'open' or now() >= v_quiz.closes_at then
    raise exception 'Quiniela cerrada';
  end if;
  if char_length(trim(p_nickname)) < 2 then
    raise exception 'Nickname inválido';
  end if;
  if trim(p_email) !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email inválido';
  end if;

  for v_question in select * from jsonb_array_elements(v_quiz.questions) loop
    v_required := v_required + 1;
    if not (p_answers ? (v_question->>'id')) then
      raise exception 'Falta respuesta: %', v_question->>'id';
    end if;
  end loop;

  v_score := public.calculate_provisional_score(p_answers);

  insert into public.submissions (
    quiniela_slug,
    nickname,
    email,
    answers,
    provisional_score
  )
  values (
    p_slug,
    trim(p_nickname),
    lower(trim(p_email)),
    p_answers,
    v_score
  )
  returning * into v_submission;

  return query
  select
    v_submission.id,
    v_submission.share_id,
    v_submission.provisional_score,
    (
      select rank from public.provisional_leaderboard_view
      where public.provisional_leaderboard_view.submission_id = v_submission.id
    );
exception
  when unique_violation then
    raise exception 'Ya participaste con ese correo';
end;
$$;

grant execute on function public.submit_quiniela(text, text, text, jsonb) to anon;

create or replace function public.score_quiniela(p_slug text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_correct jsonb;
  v_questions jsonb;
  v_updated int := 0;
  rec record;
  q jsonb;
  qid text;
  qpoints int;
  v_score int;
  v_tiebreaker int;
  v_answer_min int;
  v_correct_min int;
begin
  select answers into v_correct from public.correct_answers where quiniela_slug = p_slug;
  if v_correct is null then
    raise exception 'No correct_answers row for slug %', p_slug;
  end if;

  select questions into v_questions from public.quinielas where slug = p_slug;
  if v_questions is null then
    raise exception 'No quiniela with slug %', p_slug;
  end if;

  for rec in select id, answers from public.submissions where quiniela_slug = p_slug loop
    v_score := 0;
    v_tiebreaker := null;

    for q in select * from jsonb_array_elements(v_questions) loop
      qid := q->>'id';
      qpoints := coalesce((q->>'points')::int, 0);

      if qid = 'q14_tiebreaker' then
        if coalesce((rec.answers #>> '{q14_tiebreaker,noGoal}')::boolean, false)
           = coalesce((v_correct #>> '{q14_tiebreaker,noGoal}')::boolean, false)
           and coalesce((rec.answers #>> '{q14_tiebreaker,noGoal}')::boolean, false) then
          v_tiebreaker := 0;
        else
          v_answer_min := nullif(rec.answers #>> '{q14_tiebreaker,minute}', '')::int;
          v_correct_min := nullif(v_correct #>> '{q14_tiebreaker,minute}', '')::int;
          if v_answer_min is not null and v_correct_min is not null then
            v_tiebreaker := abs(v_answer_min - v_correct_min);
          end if;
        end if;
      elsif rec.answers->qid = v_correct->qid then
        v_score := v_score + qpoints;
      end if;
    end loop;

    update public.submissions
      set final_score = v_score,
          tiebreaker_distance = v_tiebreaker
      where id = rec.id;
    v_updated := v_updated + 1;
  end loop;

  update public.quinielas set status = 'scored', updated_at = now() where slug = p_slug;
  return v_updated;
end;
$$;

comment on function public.submit_quiniela(text, text, text, jsonb)
  is 'Public RPC used by the static frontend to create one entry per email before kickoff.';
comment on function public.score_quiniela(text)
  is 'Admin function: populate correct_answers first, then run this after the match.';
