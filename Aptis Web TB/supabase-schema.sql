-- OwlStudy clean Supabase schema.
-- Run this in the Supabase SQL editor for a new, empty project.
-- Frontend code must use only the anon public key, never the service_role key.

create extension if not exists pgcrypto;

create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  name text,
  description text,
  status text default 'active',
  created_at timestamp with time zone default now()
);

create table if not exists exams (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references subjects(id),
  title text,
  description text,
  default_question_count int default 20,
  time_limit_minutes int default 30,
  mode text default 'exam',
  status text default 'draft',
  created_at timestamp with time zone default now()
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references subjects(id),
  exam_id uuid references exams(id),
  question text,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  correct text,
  explanation text,
  status text default 'active',
  created_at timestamp with time zone default now()
);

create table if not exists materials (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references subjects(id),
  title text,
  type text,
  drive_url text,
  uploader text,
  status text default 'draft',
  created_at timestamp with time zone default now()
);

create table if not exists grade_rules (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references subjects(id) on delete cascade,
  components_json jsonb default '[]'::jsonb,
  targets_json jsonb default '{"D":4,"D+":5,"C":5.5,"C+":6.5,"B":7,"B+":8,"A":8.5}'::jsonb,
  status text default 'active',
  created_at timestamp with time zone default now()
);

create table if not exists site_settings (
  setting_key text primary key,
  value_json jsonb default '{}'::jsonb,
  updated_at timestamp with time zone default now()
);

create table if not exists attempts (
  id uuid primary key default gen_random_uuid(),
  student_name text,
  student_phone text,
  exam_id uuid references exams(id),
  subject_id uuid references subjects(id),
  score int,
  total_questions int,
  correct_count int,
  wrong_count int,
  answers_json jsonb,
  created_at timestamp with time zone default now()
);

create index if not exists idx_exams_subject_id on exams(subject_id);
create index if not exists idx_exams_status on exams(status);
create index if not exists idx_questions_exam_id on questions(exam_id);
create index if not exists idx_questions_status on questions(status);
create index if not exists idx_materials_subject_id on materials(subject_id);
create index if not exists idx_materials_status on materials(status);
create unique index if not exists idx_grade_rules_subject_id on grade_rules(subject_id);
create index if not exists idx_grade_rules_status on grade_rules(status);
create index if not exists idx_attempts_exam_id on attempts(exam_id);
create index if not exists idx_attempts_created_at on attempts(created_at);

alter table subjects enable row level security;
alter table exams enable row level security;
alter table questions enable row level security;
alter table materials enable row level security;
alter table grade_rules enable row level security;
alter table site_settings enable row level security;
alter table attempts enable row level security;

create or replace function public.is_teacher()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('teacher', 'admin');
$$;

grant usage on schema public to anon, authenticated;
grant execute on function public.is_teacher() to anon, authenticated;

grant select on subjects to anon, authenticated;
grant select on exams to anon, authenticated;
grant select on questions to anon, authenticated;
grant select on materials to anon, authenticated;
grant select on grade_rules to anon, authenticated;
grant select on site_settings to anon, authenticated;
grant insert on attempts to anon, authenticated;

grant insert, update, delete on subjects to authenticated;
grant insert, update, delete on exams to authenticated;
grant insert, update, delete on questions to authenticated;
grant insert, update, delete on materials to authenticated;
grant insert, update, delete on grade_rules to authenticated;
grant insert, update, delete on site_settings to authenticated;
grant select on attempts to authenticated;

drop policy if exists public_read_subjects on subjects;
create policy public_read_subjects
on subjects
for select
to anon, authenticated
using (coalesce(status, 'active') = 'active' or public.is_teacher());

drop policy if exists teacher_manage_subjects on subjects;
create policy teacher_manage_subjects
on subjects
for all
to authenticated
using (public.is_teacher())
with check (public.is_teacher());

drop policy if exists public_read_exams on exams;
create policy public_read_exams
on exams
for select
to anon, authenticated
using (status = 'public' or public.is_teacher());

drop policy if exists teacher_manage_exams on exams;
create policy teacher_manage_exams
on exams
for all
to authenticated
using (public.is_teacher())
with check (public.is_teacher());

drop policy if exists public_read_questions on questions;
create policy public_read_questions
on questions
for select
to anon, authenticated
using (coalesce(status, 'active') = 'active' or public.is_teacher());

drop policy if exists teacher_manage_questions on questions;
create policy teacher_manage_questions
on questions
for all
to authenticated
using (public.is_teacher())
with check (public.is_teacher());

drop policy if exists public_read_materials on materials;
create policy public_read_materials
on materials
for select
to anon, authenticated
using (
  status = 'public'
  or type in ('__owlstudy_grade_rule__', '__owlstudy_site_setting__')
  or public.is_teacher()
);

drop policy if exists teacher_manage_materials on materials;
create policy teacher_manage_materials
on materials
for all
to authenticated
using (public.is_teacher())
with check (public.is_teacher());

drop policy if exists public_read_grade_rules on grade_rules;
create policy public_read_grade_rules
on grade_rules
for select
to anon, authenticated
using (coalesce(status, 'active') = 'active' or public.is_teacher());

drop policy if exists teacher_manage_grade_rules on grade_rules;
create policy teacher_manage_grade_rules
on grade_rules
for all
to authenticated
using (public.is_teacher())
with check (public.is_teacher());

drop policy if exists public_read_site_settings on site_settings;
create policy public_read_site_settings
on site_settings
for select
to anon, authenticated
using (true);

drop policy if exists teacher_manage_site_settings on site_settings;
create policy teacher_manage_site_settings
on site_settings
for all
to authenticated
using (public.is_teacher())
with check (public.is_teacher());

drop policy if exists public_insert_attempts on attempts;
create policy public_insert_attempts
on attempts
for insert
to anon, authenticated
with check (true);

drop policy if exists teacher_read_attempts on attempts;
create policy teacher_read_attempts
on attempts
for select
to authenticated
using (public.is_teacher());
