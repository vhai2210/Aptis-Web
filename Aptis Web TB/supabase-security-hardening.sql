-- OwlStudy Supabase security hardening for an existing project.
-- Run this file in Supabase SQL Editor after backing up the database.
--
-- Required teacher setup:
-- 1. Create a teacher user in Supabase Dashboard > Authentication > Users.
-- 2. Replace the email below and run this once for that teacher:
--    update auth.users
--    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"teacher"}'::jsonb
--    where email = 'teacher@example.com';

create or replace function public.is_teacher()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('teacher', 'admin');
$$;

grant usage on schema public to anon, authenticated;
grant execute on function public.is_teacher() to anon, authenticated;

revoke insert, update, delete on subjects from anon;
revoke insert, update, delete on exams from anon;
revoke insert, update, delete on questions from anon;
revoke insert, update, delete on materials from anon;
revoke insert, update, delete on grade_rules from anon;
revoke insert, update, delete on site_settings from anon;

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

drop policy if exists temporary_anon_manage_subjects on subjects;
drop policy if exists temporary_anon_manage_exams on exams;
drop policy if exists temporary_anon_manage_questions on questions;
drop policy if exists temporary_anon_manage_materials on materials;
drop policy if exists temporary_anon_manage_grade_rules on grade_rules;
drop policy if exists temporary_anon_manage_site_settings on site_settings;
drop policy if exists temporary_anon_insert_attempts on attempts;

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
