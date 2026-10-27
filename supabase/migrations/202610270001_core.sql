-- La Fuente Digital · primera base operativa. Ejecutar como migración, no desde el navegador.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (length(trim(display_name)) between 1 and 120)
);
create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete restrict,
  role text not null check (role in ('admin','tesorero','cobranza','profe','tutor')),
  primary key (user_id,role)
);
create function private.has_role(allowed text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.user_roles where user_id = auth.uid() and role = any(allowed));
$$;

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 2 and 100),
  management text not null check (management in ('club','externa')),
  status text not null default 'activa' check (status in ('activa','inscripciones_cerradas','pausada','finalizada')),
  description text not null default '', color text not null default '#315b9f',
  created_at timestamptz not null default now()
);
create table public.instructor_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  activity_id uuid not null references public.activities(id),
  mode text not null check (mode in ('interno','externo')),
  start_date date not null default current_date, end_date date,
  check (end_date is null or end_date >= start_date),
  unique(user_id,activity_id,start_date)
);
create function private.teaches(activity uuid, external_only boolean default false) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role(array['profe']) and exists(
    select 1 from public.instructor_assignments where user_id = auth.uid()
    and activity_id = activity and start_date <= current_date
    and (end_date is null or end_date >= current_date)
    and (not external_only or mode = 'externo')
  );
$$;

create table public.people (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (length(trim(first_name)) between 1 and 100),
  last_name text not null check (length(trim(last_name)) between 1 and 100),
  birth_date date not null check (birth_date >= date '1900-01-01'),
  validation_status text not null default 'pendiente' check (validation_status in ('pendiente','validada')),
  created_at timestamptz not null default now()
);
create table public.tutor_links (
  tutor_id uuid not null references public.profiles(id), person_id uuid not null references public.people(id),
  validated_by uuid not null references public.profiles(id),
  primary key(tutor_id,person_id)
);
create table public.enrollments (
  id uuid primary key default gen_random_uuid(), person_id uuid not null references public.people(id),
  activity_id uuid not null references public.activities(id), start_date date not null,
  end_date date, status text not null default 'pendiente' check (status in ('pendiente','activa','pausada','baja')),
  check (end_date is null or end_date >= start_date),
  check ((status = 'baja') = (end_date is not null))
);
create unique index enrollment_one_open on public.enrollments(person_id,activity_id) where end_date is null;
create index enrollment_activity on public.enrollments(activity_id);
create index assignment_user on public.instructor_assignments(user_id);

create function private.sees_person(person uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select private.has_role(array['admin','tesorero','cobranza'])
 or exists(select 1 from public.tutor_links where tutor_id = auth.uid() and person_id = person)
 or exists(select 1 from public.enrollments e where e.person_id = person and private.teaches(e.activity_id));
$$;

create table public.training_groups (
 id uuid primary key default gen_random_uuid(), activity_id uuid not null references public.activities(id),
 season integer not null check (season between 2000 and 2200), name text not null check(length(trim(name)) between 1 and 100),
 birth_years integer[] not null default '{}', unique(activity_id,season,name)
);
create table public.group_members (
 group_id uuid not null references public.training_groups(id), enrollment_id uuid not null references public.enrollments(id),
 primary key(group_id,enrollment_id)
);
create function private.sees_group(grp uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select private.has_role(array['admin']) or exists(
 select 1 from public.training_groups g where g.id = grp and (
 private.teaches(g.activity_id) or exists(select 1 from public.group_members m
 join public.enrollments e on e.id = m.enrollment_id
 join public.tutor_links t on t.person_id = e.person_id
 where m.group_id = g.id and t.tutor_id = auth.uid())));
$$;
create function private.manages_group(grp uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select private.has_role(array['admin']) or exists(select 1 from public.training_groups g
 where g.id = grp and private.teaches(g.activity_id));
$$;
create table public.attendance (
 id uuid primary key default gen_random_uuid(), group_id uuid not null, enrollment_id uuid not null,
 class_date date not null, present boolean not null,
 recorded_by uuid not null default auth.uid() references public.profiles(id),
 foreign key(group_id,enrollment_id) references public.group_members(group_id,enrollment_id),
 unique(group_id,enrollment_id,class_date)
);
create table public.matches (
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.training_groups(id),
 opponent text not null check(length(trim(opponent)) between 1 and 100),
 venue text not null check(venue in ('local','visitante')), scheduled_at timestamptz not null,
 status text not null default 'programado' check(status in ('programado','postergado','finalizado','anulado')),
 home_score integer check(home_score between 0 and 99), away_score integer check(away_score between 0 and 99),
 result_status text not null default 'sin_cargar' check(result_status in ('sin_cargar','pendiente','confirmado')),
 check ((home_score is null) = (away_score is null)),
 check ((result_status = 'sin_cargar') = (home_score is null)),
 check (home_score is null or status = 'finalizado')
);
create table public.rental_agreements (
 id uuid primary key default gen_random_uuid(), instructor_id uuid not null references public.profiles(id),
 activity_id uuid not null references public.activities(id), space_name text not null,
 schedule_label text not null, amount_cents bigint check(amount_cents >= 0), basis text not null default 'A definir',
 active boolean not null default true
);
-- Los valores de alquiler nunca se agregan a la ficha de alumno.
create table private.audit_log (
 id bigint generated always as identity primary key, actor uuid, happened_at timestamptz not null default now(),
 table_name text not null, record_id text not null, action text not null, before_value jsonb, after_value jsonb
);
create function private.audit_change() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into private.audit_log(actor,table_name,record_id,action,before_value,after_value)
 values(auth.uid(),tg_table_name,coalesce(to_jsonb(new)->>'id',to_jsonb(new)->>'group_id','relation'),tg_op,
 case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end; $$;
create function private.check_group_member() returns trigger language plpgsql set search_path = '' as $$
begin
 if not exists(select 1 from public.training_groups g join public.enrollments e on e.activity_id = g.activity_id
 where g.id = new.group_id and e.id = new.enrollment_id and e.status = 'activa') then
 raise exception 'La inscripción debe estar activa y pertenecer a la misma actividad.'; end if;
 return new;
end; $$;
create trigger check_member before insert or update on public.group_members for each row execute function private.check_group_member();

-- Acceso por defecto denegado. Sin DELETE para usuarios de la aplicación.
do $$ declare t text; begin
 foreach t in array array['profiles','user_roles','activities','instructor_assignments','people','tutor_links','enrollments','training_groups','group_members','attendance','matches','rental_agreements'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create trigger %I after insert or update on public.%I for each row execute function private.audit_change()','audit_'||t,t);
 end loop;
end $$;
alter table private.audit_log enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid() or private.has_role(array['admin']));
create policy roles_read on public.user_roles for select to authenticated using(user_id=auth.uid() or private.has_role(array['admin']));
create policy activities_read on public.activities for select to authenticated using(true);
create policy assignment_read on public.instructor_assignments for select to authenticated using(user_id=auth.uid() or private.has_role(array['admin']));
create policy people_read on public.people for select to authenticated using(private.sees_person(id));
create policy tutor_read on public.tutor_links for select to authenticated using(tutor_id=auth.uid() or private.has_role(array['admin']));
create policy enrollments_read on public.enrollments for select to authenticated using(private.has_role(array['admin','tesorero','cobranza']) or private.teaches(activity_id) or exists(select 1 from public.tutor_links t where t.person_id=enrollments.person_id and t.tutor_id=auth.uid()));
create policy groups_read on public.training_groups for select to authenticated using(private.sees_group(id));
create policy members_read on public.group_members for select to authenticated using(private.manages_group(group_id) or exists(select 1 from public.enrollments e join public.tutor_links t on t.person_id=e.person_id where e.id=group_members.enrollment_id and t.tutor_id=auth.uid()));
create policy attendance_read on public.attendance for select to authenticated using(private.has_role(array['admin']) or private.manages_group(group_id) or exists(select 1 from public.enrollments e join public.tutor_links t on t.person_id=e.person_id where e.id=enrollment_id and t.tutor_id=auth.uid()));
create policy matches_read on public.matches for select to authenticated using(private.sees_group(group_id));
create policy rental_read on public.rental_agreements for select to authenticated using(instructor_id=auth.uid() or private.has_role(array['admin','tesorero']));

grant insert,update on public.activities,public.training_groups,public.group_members,public.matches to authenticated;
grant insert,update on public.attendance to authenticated;
create policy activities_write on public.activities for all to authenticated using(private.has_role(array['admin'])) with check(private.has_role(array['admin']));
create policy groups_write on public.training_groups for all to authenticated using(private.has_role(array['admin'])) with check(private.has_role(array['admin']));
create policy members_write on public.group_members for all to authenticated using(private.has_role(array['admin'])) with check(private.has_role(array['admin']));
create policy matches_insert on public.matches for insert to authenticated with check(private.has_role(array['admin']));
-- Las actualizaciones de resultados usan RPC para impedir confirmación por un profesor.
revoke update on public.matches from authenticated;
create policy attendance_insert on public.attendance for insert to authenticated with check(private.manages_group(group_id) and recorded_by=auth.uid());
create policy attendance_update on public.attendance for update to authenticated using(private.manages_group(group_id)) with check(private.manages_group(group_id) and recorded_by=auth.uid());

create function public.register_student(first_name text,last_name text,birth_date date,activity_id uuid,start_date date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare p uuid; begin
 if not (private.has_role(array['admin']) or private.teaches(activity_id,true)) then raise exception 'Sin permiso para inscribir.'; end if;
 perform 1 from public.activities a where a.id=activity_id and a.status='activa' for update;
 if not found then raise exception 'La actividad no acepta nuevas inscripciones.'; end if;
 if birth_date > current_date or start_date < birth_date then raise exception 'Fechas inválidas.'; end if;
 insert into public.people(first_name,last_name,birth_date) values(trim(first_name),trim(last_name),birth_date) returning id into p;
 insert into public.enrollments(person_id,activity_id,start_date) values(p,activity_id,start_date);
 return p;
end; $$;
create function public.validate_student(person uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
 if not private.has_role(array['admin']) then raise exception 'Solo administración puede validar.'; end if;
 update public.people set validation_status='validada' where id=person;
 update public.enrollments set status='activa' where person_id=person and status='pendiente';
end; $$;
create function public.end_enrollment(enrollment uuid,effective_date date) returns void language plpgsql security definer set search_path = '' as $$
declare e public.enrollments; begin
 select * into e from public.enrollments where id=enrollment for update;
 if not found or not(private.has_role(array['admin']) or private.teaches(e.activity_id,true)) then raise exception 'Sin permiso para dar de baja.'; end if;
 if e.status='baja' then return; end if;
 if effective_date > current_date or effective_date < e.start_date then raise exception 'Fecha de baja inválida.'; end if;
 update public.enrollments set status='baja',end_date=effective_date where id=enrollment;
end; $$;
create function public.save_result(match_id uuid,home integer,away integer,confirm_result boolean default false) returns void language plpgsql security definer set search_path = '' as $$
declare g uuid; begin
 select group_id into g from public.matches where id=match_id for update;
 if not found or not private.manages_group(g) then raise exception 'Sin permiso para este partido.'; end if;
 if confirm_result and not private.has_role(array['admin']) then raise exception 'Solo administración confirma resultados.'; end if;
 update public.matches set home_score=home,away_score=away,status='finalizado',
 result_status=case when confirm_result then 'confirmado' else 'pendiente' end where id=match_id;
end; $$;
-- Las funciones SECURITY DEFINER no son ejecutables por visitantes anónimos.
revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated;
revoke all on function public.register_student(text,text,date,uuid,date), public.validate_student(uuid), public.end_enrollment(uuid,date), public.save_result(uuid,integer,integer,boolean) from public,anon,authenticated;
grant execute on function public.register_student(text,text,date,uuid,date), public.validate_student(uuid), public.end_enrollment(uuid,date), public.save_result(uuid,integer,integer,boolean) to authenticated;

insert into public.activities(name,management,description,color) values
 ('Fútbol formativo','club','Formación, equipo y encuentro.','#1360b3');
commit;
