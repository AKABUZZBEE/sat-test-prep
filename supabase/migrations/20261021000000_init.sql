-- Each generated test set is stored per user. A user has at most one
-- in-progress test; a new one is only generated when they ask to retake.
create table public.tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  questions jsonb not null,
  -- { "<questionId>": { "choice": 0-3 | null, "skipped": bool } }
  answers jsonb not null default '{}'::jsonb,
  current_index int not null default 0,
  score int,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index tests_one_in_progress_per_user
  on public.tests (user_id) where status = 'in_progress';
create index tests_user_created on public.tests (user_id, created_at desc);

create table public.study_guides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  test_id uuid not null references public.tests (id) on delete cascade,
  topic text not null,
  guide jsonb not null,
  created_at timestamptz not null default now(),
  unique (test_id, topic)
);

alter table public.tests enable row level security;
alter table public.study_guides enable row level security;

-- Tests and guides are created only by edge functions (service role).
-- Students can read their own rows and record answers on their own tests.
create policy "read own tests" on public.tests
  for select using (auth.uid() = user_id);
create policy "answer own tests" on public.tests
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "read own guides" on public.study_guides
  for select using (auth.uid() = user_id);

-- Students may only change answer progress, never the questions themselves.
create function public.tests_guard_update() returns trigger
language plpgsql as $$
begin
  if auth.role() = 'authenticated' then
    if new.questions is distinct from old.questions
       or new.user_id is distinct from old.user_id
       or new.created_at is distinct from old.created_at then
      raise exception 'questions cannot be modified';
    end if;
    if old.status = 'completed' and new.status = 'in_progress' then
      raise exception 'a completed test cannot be reopened';
    end if;
  end if;
  return new;
end $$;

create trigger tests_guard_update before update on public.tests
  for each row execute function public.tests_guard_update();
