-- Question sets are now a shared pool reused across students. Each student's
-- try at a set is an attempt; a student can never get the same set twice.

create table public.test_sets (
  id uuid primary key default gen_random_uuid(),
  questions jsonb not null,
  created_at timestamptz not null default now()
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  set_id uuid not null references public.test_sets (id),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  -- Per-student shuffle: { "order": [question index...], "choices": { "<questionId>": [original choice index...] } }
  layout jsonb not null,
  -- { "<questionId>": { "choice": displayed index 0-3 | null, "skipped": bool } }
  answers jsonb not null default '{}'::jsonb,
  current_index int not null default 0,
  score int,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, set_id)
);

create unique index attempts_one_in_progress_per_user
  on public.attempts (user_id) where status = 'in_progress';
create index attempts_user_created on public.attempts (user_id, created_at desc);
create index attempts_set on public.attempts (set_id);

-- Guides are shared by every student who misses that topic on that set.
create table public.set_study_guides (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.test_sets (id) on delete cascade,
  topic text not null,
  guide jsonb not null,
  created_at timestamptz not null default now(),
  unique (set_id, topic)
);

-- Carry over anything created under the old per-student schema.
insert into public.test_sets (id, questions, created_at)
  select id, questions, created_at from public.tests;
insert into public.attempts (id, user_id, set_id, status, layout, answers, current_index, score, created_at, completed_at)
  select t.id, t.user_id, t.id, t.status,
         jsonb_build_object(
           'order', (select coalesce(jsonb_agg(i - 1), '[]'::jsonb) from generate_series(1, jsonb_array_length(t.questions)) i),
           'choices', '{}'::jsonb),
         t.answers, t.current_index, t.score, t.created_at, t.completed_at
  from public.tests t;
insert into public.set_study_guides (set_id, topic, guide, created_at)
  select distinct on (test_id, topic) test_id, topic, guide, created_at from public.study_guides;

drop table public.study_guides;
drop table public.tests;
drop function public.tests_guard_update();

alter table public.test_sets enable row level security;
alter table public.attempts enable row level security;
alter table public.set_study_guides enable row level security;

-- Sets, attempts and guides are created only by edge functions (service role).
create policy "read own attempts" on public.attempts
  for select using (auth.uid() = user_id);
create policy "answer own attempts" on public.attempts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "read sets you are taking" on public.test_sets
  for select using (exists (
    select 1 from public.attempts a where a.set_id = test_sets.id and a.user_id = auth.uid()));
create policy "read guides for your sets" on public.set_study_guides
  for select using (exists (
    select 1 from public.attempts a where a.set_id = set_study_guides.set_id and a.user_id = auth.uid()));

-- Students may only change answer progress, never which set or layout they got.
create function public.attempts_guard_update() returns trigger
language plpgsql as $$
begin
  if auth.role() = 'authenticated' then
    if new.set_id is distinct from old.set_id
       or new.layout is distinct from old.layout
       or new.user_id is distinct from old.user_id
       or new.created_at is distinct from old.created_at then
      raise exception 'only answers can be changed';
    end if;
    if old.status = 'completed' and new.status = 'in_progress' then
      raise exception 'a completed test cannot be reopened';
    end if;
  end if;
  return new;
end $$;

create trigger attempts_guard_update before update on public.attempts
  for each row execute function public.attempts_guard_update();

-- A random set this student has never taken, or null when they've seen them all.
create function public.pick_unseen_set(p_user uuid, p_min_unseen int)
returns uuid
language sql stable as $$
  with unseen as (
    select s.id from public.test_sets s
    where not exists (select 1 from public.attempts a where a.set_id = s.id and a.user_id = p_user)
  )
  select id from unseen
  where (select count(*) from unseen) >= p_min_unseen
  order by random()
  limit 1;
$$;
revoke execute on function public.pick_unseen_set(uuid, int) from public, anon, authenticated;
