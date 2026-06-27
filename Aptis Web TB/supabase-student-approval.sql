-- Student approval and secure session migration.
-- Run this in Supabase SQL Editor for the existing Aptis v TSA project.

create extension if not exists pgcrypto;

-- Drop existing functions to prevent "cannot change return type of existing function" error
drop function if exists public.is_teacher() cascade;
drop function if exists public.register_student_account(text, text, text) cascade;
drop function if exists public.login_student_account(text, text) cascade;
drop function if exists public.validate_student_session(text, text) cascade;
drop function if exists public.logout_student_account(text, text) cascade;
drop function if exists public.teacher_list_student_accounts(text) cascade;
drop function if exists public.teacher_approve_student_account(uuid) cascade;
drop function if exists public.teacher_block_student_account(uuid) cascade;
drop function if exists public.teacher_delete_student_account(uuid) cascade;

create or replace function public.is_teacher()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('teacher', 'admin');
$$;

grant usage on schema public to anon, authenticated;
grant execute on function public.is_teacher() to anon, authenticated;

create table if not exists public.student_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  name text not null,
  citizen_id text,
  email text,
  exam_date date,
  province text,
  district text,
  ward text,
  password_hash text not null,
  status text default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  approved_at timestamptz,
  approved_by uuid,
  blocked_at timestamptz,
  blocked_by uuid,
  session_token text,
  session_expires_at timestamptz
);

alter table public.student_accounts
  add column if not exists citizen_id text,
  add column if not exists email text,
  add column if not exists exam_date date,
  add column if not exists province text,
  add column if not exists district text,
  add column if not exists ward text;

alter table public.student_accounts enable row level security;

create policy "teacher_full_access" on public.student_accounts
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

create policy "anon_read_own" on public.student_accounts
  for select to anon
  using (true);

create or replace function public.register_student_account(
  p_username text,
  p_name text,
  p_password text,
  p_citizen_id text default null,
  p_email text default null,
  p_exam_date date default null,
  p_province text default null,
  p_district text default null,
  p_ward text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_account student_accounts;
  hashed_password text;
begin
  p_username := lower(trim(p_username));
  p_name := trim(p_name);
  p_citizen_id := trim(coalesce(p_citizen_id, ''));
  p_email := lower(trim(coalesce(p_email, '')));
  p_province := trim(coalesce(p_province, ''));
  p_district := trim(coalesce(p_district, ''));
  p_ward := trim(coalesce(p_ward, ''));

  if length(p_username) < 3 then
    return jsonb_build_object('error', 'username_too_short');
  end if;

  if length(p_password) < 6 then
    return jsonb_build_object('error', 'password_too_short');
  end if;

  if p_citizen_id !~ '^[0-9]{12}$' then
    return jsonb_build_object('error', 'citizen_id_invalid');
  end if;

  if p_email !~ '^[^@\s]+@gmail\.com$' then
    return jsonb_build_object('error', 'email_invalid');
  end if;

  if p_exam_date is null or p_province = '' or p_district = '' or p_ward = '' then
    return jsonb_build_object('error', 'profile_required');
  end if;

  if exists (select 1 from student_accounts where username = p_username) then
    return jsonb_build_object('error', 'username_exists');
  end if;

  hashed_password := crypt(p_password, gen_salt('bf'));

  insert into student_accounts (
    username, name, citizen_id, email, exam_date, province, district, ward, password_hash, status
  )
  values (
    p_username, p_name, p_citizen_id, p_email, p_exam_date, p_province, p_district, p_ward, hashed_password, 'pending'
  )
  returning * into new_account;

  return jsonb_build_object(
    'id', new_account.id,
    'username', new_account.username,
    'name', new_account.name,
    'citizen_id', new_account.citizen_id,
    'email', new_account.email,
    'exam_date', new_account.exam_date,
    'province', new_account.province,
    'district', new_account.district,
    'ward', new_account.ward,
    'status', new_account.status
  );
end;
$$;

create or replace function public.login_student_account(
  p_username text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row student_accounts;
  new_token text;
  expires_at timestamptz;
begin
  p_username := lower(trim(p_username));

  select * into account_row
  from student_accounts
  where username = p_username;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  if account_row.password_hash != crypt(p_password, account_row.password_hash) then
    return jsonb_build_object('error', 'wrong_password');
  end if;

  if account_row.status = 'pending' then
    return jsonb_build_object('error', 'pending_approval');
  end if;

  if account_row.status = 'blocked' then
    return jsonb_build_object('error', 'blocked');
  end if;

  new_token := encode(gen_random_bytes(32), 'hex');
  expires_at := now() + interval '30 days';

  update student_accounts
  set
    session_token = new_token,
    session_expires_at = expires_at,
    updated_at = now()
  where id = account_row.id;

  return jsonb_build_object(
    'id', account_row.id,
    'username', account_row.username,
    'name', account_row.name,
    'citizen_id', account_row.citizen_id,
    'email', account_row.email,
    'exam_date', account_row.exam_date,
    'province', account_row.province,
    'district', account_row.district,
    'ward', account_row.ward,
    'status', account_row.status,
    'session_token', new_token,
    'session_expires_at', expires_at
  );
end;
$$;

create or replace function public.validate_student_session(
  p_username text,
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row student_accounts;
begin
  p_username := lower(trim(p_username));

  select * into account_row
  from student_accounts
  where username = p_username
    and session_token = p_token
    and session_expires_at > now();

  if not found then
    return jsonb_build_object('valid', false);
  end if;

  if account_row.status != 'approved' then
    return jsonb_build_object('valid', false, 'error', account_row.status);
  end if;

  return jsonb_build_object(
    'valid', true,
    'id', account_row.id,
    'username', account_row.username,
    'name', account_row.name,
    'citizen_id', account_row.citizen_id,
    'email', account_row.email,
    'exam_date', account_row.exam_date,
    'province', account_row.province,
    'district', account_row.district,
    'ward', account_row.ward,
    'status', account_row.status
  );
end;
$$;

create or replace function public.logout_student_account(
  p_username text,
  p_token text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  p_username := lower(trim(p_username));

  update student_accounts
  set
    session_token = null,
    session_expires_at = null,
    updated_at = now()
  where username = p_username
    and session_token = p_token;

  return true;
end;
$$;

create or replace function public.teacher_list_student_accounts(
  p_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  results jsonb;
begin
  if not public.is_teacher() then
    raise exception 'not allowed';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'id', id,
      'username', username,
      'name', name,
      'citizen_id', citizen_id,
      'email', email,
      'exam_date', exam_date,
      'province', province,
      'district', district,
      'ward', ward,
      'status', status,
      'created_at', created_at,
      'approved_at', approved_at,
      'blocked_at', blocked_at
    ) order by created_at desc
  )
  into results
  from student_accounts
  where (p_status is null or status = p_status);

  return coalesce(results, '[]'::jsonb);
end;
$$;

create or replace function public.teacher_approve_student_account(account_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row student_accounts;
begin
  if not public.is_teacher() then
    raise exception 'not allowed';
  end if;

  update student_accounts
  set
    status = 'approved',
    approved_at = now(),
    approved_by = auth.uid(),
    updated_at = now()
  where id = account_id
  returning * into account_row;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  return jsonb_build_object(
    'id', account_row.id,
    'username', account_row.username,
    'name', account_row.name,
    'status', account_row.status,
    'approved_at', account_row.approved_at
  );
end;
$$;

create or replace function public.teacher_block_student_account(account_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row student_accounts;
begin
  if not public.is_teacher() then
    raise exception 'not allowed';
  end if;

  update student_accounts
  set
    status = 'blocked',
    blocked_at = now(),
    blocked_by = auth.uid(),
    session_token = null,
    session_expires_at = null,
    updated_at = now()
  where id = account_id
  returning * into account_row;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  return jsonb_build_object(
    'id', account_row.id,
    'username', account_row.username,
    'name', account_row.name,
    'status', account_row.status,
    'blocked_at', account_row.blocked_at
  );
end;
$$;

create or replace function public.teacher_delete_student_account(account_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_teacher() then
    raise exception 'not allowed';
  end if;

  delete from student_accounts where id = account_id;
  return true;
end;
$$;

grant execute on function public.register_student_account(text, text, text, text, text, date, text, text, text) to anon, authenticated;
grant execute on function public.login_student_account(text, text) to anon, authenticated;
grant execute on function public.validate_student_session(text, text) to anon, authenticated;
grant execute on function public.logout_student_account(text, text) to anon, authenticated;
grant execute on function public.teacher_list_student_accounts(text) to authenticated;
grant execute on function public.teacher_approve_student_account(uuid) to authenticated;
grant execute on function public.teacher_block_student_account(uuid) to authenticated;
grant execute on function public.teacher_delete_student_account(uuid) to authenticated;
