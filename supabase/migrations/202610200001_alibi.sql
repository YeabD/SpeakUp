-- Apply with the normal Supabase migration runner before enabling Alibi.
alter table public.daily_quests add column if not exists alibi_count integer not null default 0;
create table public.alibi_attempts (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  session_number integer not null check (session_number between 1 and 15),
  case_file jsonb not null check (jsonb_array_length(case_file->'clues') = 3),
  turns jsonb not null default '[]' check (jsonb_array_length(turns) <= 3),
  question text, evaluation jsonb, created_at timestamptz not null default now()
);
create index alibi_attempts_owner on public.alibi_attempts(user_id, created_at desc);
create table public.alibi_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_number integer not null check (session_number between 1 and 15),
  attempt_id uuid not null references public.alibi_attempts(id),
  score integer not null check (score between 75 and 100), created_at timestamptz not null default now(),
  primary key (user_id, session_number)
);
alter table public.alibi_attempts enable row level security;
alter table public.alibi_completions enable row level security;
create policy alibi_read_own on public.alibi_attempts for select to authenticated using (auth.uid() = user_id);
create policy alibi_progress_own on public.alibi_completions for select to authenticated using (auth.uid() = user_id);
revoke all on public.alibi_attempts, public.alibi_completions from anon, authenticated;
grant select on public.alibi_attempts, public.alibi_completions to authenticated;
grant all on public.alibi_attempts, public.alibi_completions to service_role;

create or replace function public.alibi_mutate(p_user uuid, p_id uuid, p_action text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  a public.alibi_attempts%rowtype; n integer; awarded integer := 0; qid uuid; final_score integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('alibi:' || p_user::text, 0));
  select count(*) into n from public.alibi_completions where user_id = p_user;
  if p_action = 'start' then
    select * into a from public.alibi_attempts where user_id = p_user and id = p_id;
    if a.id is null then
      select * into a from public.alibi_attempts where user_id = p_user and evaluation is null order by created_at desc limit 1;
    end if;
    if a.id is null then
      if n >= 15 then raise exception 'All sessions completed'; end if;
      insert into public.alibi_attempts(id, user_id, session_number, case_file)
      values(p_id, p_user, n + 1, p_payload->'case_file') returning * into a;
    end if;
  else
    select * into a from public.alibi_attempts where id = p_id and user_id = p_user for update;
    if a.id is null then raise exception 'Attempt not found'; end if;
    if p_action = 'question' and a.evaluation is null then
      if a.question is null and jsonb_array_length(a.turns) = (p_payload->>'index')::integer and jsonb_array_length(a.turns) < 3 then
        update public.alibi_attempts set question = p_payload->>'question' where id = a.id returning * into a;
      end if;
    elsif p_action = 'turn' and a.evaluation is null then
      if jsonb_array_length(a.turns) = (p_payload->>'index')::integer then
        if a.question is null or a.question <> p_payload->'turn'->>'question' then raise exception 'Question mismatch'; end if;
        if jsonb_array_length(a.turns) >= 3 then raise exception 'Three turns already complete'; end if;
        update public.alibi_attempts set turns = turns || jsonb_build_array(p_payload->'turn'), question = null where id = a.id returning * into a;
      elsif a.turns->((p_payload->>'index')::integer) is distinct from p_payload->'turn' then
        raise exception 'Turn already saved with a different answer';
      end if;
    elsif p_action = 'evaluate' and a.evaluation is null then
      if jsonb_array_length(a.turns) <> 3 then raise exception 'Exactly three turns required'; end if;
      final_score := round((p_payload->'evaluation'->'criteria_scores'->>'grammar')::numeric * .30
        + (p_payload->'evaluation'->'criteria_scores'->>'consistency')::numeric * .25
        + (p_payload->'evaluation'->'criteria_scores'->>'evidence')::numeric * .20
        + (p_payload->'evaluation'->'criteria_scores'->>'vocabulary')::numeric * .15
        + (p_payload->'evaluation'->'criteria_scores'->>'relevance_fluency')::numeric * .10);
      update public.alibi_attempts set evaluation = (p_payload->'evaluation') || jsonb_build_object('score', final_score, 'is_passed', final_score >= 75) where id = a.id returning * into a;
      if final_score >= 75 and a.session_number = n + 1 then
        insert into public.alibi_completions(user_id, session_number, attempt_id, score)
        values(p_user, a.session_number, a.id, final_score) on conflict do nothing;
        get diagnostics awarded = row_count;
        if awarded = 1 then
          n := n + 1;
          select id into qid from public.daily_quests where user_id = p_user and date = (now() at time zone 'UTC')::date for update;
          if qid is null then
            insert into public.daily_quests(user_id, date, quest_type, completed, reward_xp, alibi_count)
            values(p_user, (now() at time zone 'UTC')::date, 'daily_practice', false, 50, 1);
          else
            update public.daily_quests set alibi_count = alibi_count + 1 where id = qid;
          end if;
          update public.module_progress set completed_sessions_in_level = n, current_level = 1,
            completed = n = 15, score = final_score,
            average_accuracy = (select avg(score) from public.alibi_completions where user_id = p_user), updated_at = now()
            where user_id = p_user and module_id = 'alibi';
          if not found then
            insert into public.module_progress(user_id, module_id, current_level, completed_sessions_in_level, completed, score, average_accuracy)
            values(p_user, 'alibi', 1, n, n = 15, final_score, (select avg(score) from public.alibi_completions where user_id = p_user));
          end if;
          insert into public.level_sessions(user_id, module_type, level_number, session_number, accuracy_score, status, transcript, metrics)
          values(p_user, 'alibi', 1, a.session_number, final_score, 'completed', a.turns::text, a.evaluation);
        end if;
      end if;
    end if;
  end if;
  return to_jsonb(a) || jsonb_build_object('completed_sessions', n);
end;
$$;
revoke all on function public.alibi_mutate(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.alibi_mutate(uuid, uuid, text, jsonb) to service_role;
