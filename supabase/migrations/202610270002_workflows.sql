-- Flujos por actividad: altas directas de admin, jornadas completas y acuerdos editables.
begin;

create or replace function public.register_student(first_name text,last_name text,birth_date date,activity_id uuid,start_date date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare p uuid; approved boolean := private.has_role(array['admin']); begin
 if not (approved or private.teaches(activity_id,true)) then raise exception 'Sin permiso para inscribir.'; end if;
 perform 1 from public.activities a where a.id=activity_id and a.status='activa' for update;
 if not found then raise exception 'La actividad no acepta nuevas inscripciones.'; end if;
 if birth_date > current_date or start_date < birth_date then raise exception 'Fechas inválidas.'; end if;
 insert into public.people(first_name,last_name,birth_date,validation_status)
 values(trim(first_name),trim(last_name),birth_date,case when approved then 'validada' else 'pendiente' end) returning id into p;
 insert into public.enrollments(person_id,activity_id,start_date,status)
 values(p,activity_id,start_date,case when approved then 'activa' else 'pendiente' end);
 return p;
end; $$;

create function public.register_student_in_group(first_name text,last_name text,birth_date date,activity_id uuid,start_date date,group_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare person uuid; enrollment uuid; begin
 if not private.has_role(array['admin']) then raise exception 'Solo administración puede asignar grupos en el alta.'; end if;
 person := public.register_student(first_name,last_name,birth_date,activity_id,start_date);
 select e.id into enrollment from public.enrollments e where e.person_id=person and e.activity_id=register_student_in_group.activity_id and e.end_date is null;
 insert into public.group_members(group_id,enrollment_id) values(group_id,enrollment);
 return person;
end; $$;

create function public.add_group_members(group_id uuid,enrollment_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if not private.has_role(array['admin']) then raise exception 'Solo administración puede asignar integrantes.'; end if;
 if cardinality(enrollment_ids) is null or cardinality(enrollment_ids) not between 1 and 500 then raise exception 'Elegí entre 1 y 500 integrantes.'; end if;
 -- El trigger existente valida actividad y estado por cada integrante. Todo se guarda o nada.
 insert into public.group_members(group_id,enrollment_id)
 select group_id, id from unnest(enrollment_ids) as ids(id) on conflict do nothing;
end; $$;

create table public.club_settings (
 id integer primary key check(id=1), address text not null check(length(trim(address)) between 1 and 300)
);
insert into public.club_settings values(1,'Dr. A Melo 3951, Remedios de Escalada.');
alter table public.club_settings enable row level security;
revoke all on public.club_settings from anon,authenticated;
grant select,update on public.club_settings to authenticated;
create policy settings_read on public.club_settings for select to authenticated using(true);
create policy settings_update on public.club_settings for update to authenticated using(private.has_role(array['admin'])) with check(private.has_role(array['admin']));
create trigger audit_settings after insert or update on public.club_settings for each row execute function private.audit_change();

alter table public.matches alter column group_id drop not null;
alter table public.matches add column jornada_id uuid;
alter table public.matches add column activity_id uuid references public.activities(id);
alter table public.matches add column category text check(length(trim(category)) between 1 and 100);
alter table public.matches add column series text not null default '' check(length(series)<=100);
alter table public.matches add column location_name text check(length(trim(location_name)) between 1 and 150);
alter table public.matches add column address text check(length(trim(address)) between 1 and 300);
alter table public.matches add constraint match_activity_or_group check(group_id is not null or activity_id is not null);
create index match_jornada on public.matches(jornada_id);
drop policy matches_read on public.matches;
create policy matches_read on public.matches for select to authenticated using(
 private.has_role(array['admin']) or private.sees_group(group_id) or private.teaches(activity_id)
 or exists(select 1 from public.enrollments e join public.tutor_links t on t.person_id=e.person_id where e.activity_id=matches.activity_id and t.tutor_id=auth.uid())
);
-- Las nuevas cargas y sus ediciones pasan por una operación atómica.
revoke insert on public.matches from authenticated;

create function public.save_jornada(rows jsonb,original_ids uuid[] default null) returns void
language plpgsql security definer set search_path = '' as $$
declare r jsonb; first_row jsonb; j uuid; a uuid; old_j uuid; old_a uuid; n integer; i integer := 1; previous public.matches; previous_category text;
begin
 if not private.has_role(array['admin']) then raise exception 'Solo administración puede agendar jornadas.'; end if;
 if jsonb_typeof(rows) <> 'array' or jsonb_array_length(rows) not between 1 and 30 then raise exception 'Jornada inválida.'; end if;
 first_row := rows->0; j := (first_row->>'jornada_id')::uuid; a := (first_row->>'activity_id')::uuid;
 if j is null or a is null then raise exception 'Falta actividad o jornada.'; end if;
 perform 1 from public.activities where id=a for update;
 if not found then raise exception 'Actividad inexistente.'; end if;
 if original_ids is not null then
   if cardinality(original_ids) <> jsonb_array_length(rows) or cardinality(original_ids) <> (select count(distinct x) from unnest(original_ids) x) then raise exception 'La edición debe conservar todas las categorías.'; end if;
   perform 1 from public.matches where id=any(original_ids) order by id for update;
   select coalesce(m.jornada_id,m.id),coalesce(m.activity_id,g.activity_id) into old_j,old_a from public.matches m left join public.training_groups g on g.id=m.group_id where m.id=original_ids[1];
   select count(*) into n from public.matches m where coalesce(m.jornada_id,m.id)=old_j;
   if old_j is null or old_j<>j or old_a<>a or n<>cardinality(original_ids)
      or exists(select 1 from unnest(original_ids) x left join public.matches m on m.id=x where m.id is null or coalesce(m.jornada_id,m.id)<>old_j) then raise exception 'La jornada cambió. Volvé a cargarla.'; end if;
 else
   if exists(select 1 from public.matches where jornada_id=j or id=j) then raise exception 'La jornada ya existe.'; end if;
 end if;
 if (select count(distinct lower(trim(x->>'category'))) from jsonb_array_elements(rows) x) <> jsonb_array_length(rows) then raise exception 'Categorías vacías o repetidas.'; end if;
 for r in select value from jsonb_array_elements(rows) loop
   if (r->>'jornada_id')::uuid is distinct from j or (r->>'activity_id')::uuid is distinct from a
     or r->>'opponent' is distinct from first_row->>'opponent' or r->>'venue' is distinct from first_row->>'venue'
     or r->>'series' is distinct from first_row->>'series' or r->>'location_name' is distinct from first_row->>'location_name'
     or r->>'address' is distinct from first_row->>'address'
     or ((r->>'scheduled_at')::timestamptz at time zone 'America/Argentina/Buenos_Aires')::date is distinct from ((first_row->>'scheduled_at')::timestamptz at time zone 'America/Argentina/Buenos_Aires')::date
     or coalesce(length(trim(r->>'category')),0) not between 1 and 100
     or coalesce(length(trim(r->>'address')),0) not between 1 and 300
     or coalesce(length(trim(r->>'location_name')),0) not between 1 and 150 then raise exception 'Revisá categoría, fecha, cancha y dirección de cada partido.'; end if;
   if original_ids is null then
     insert into public.matches(id,jornada_id,activity_id,category,series,opponent,venue,location_name,address,scheduled_at)
     values((r->>'id')::uuid,j,a,trim(r->>'category'),coalesce(r->>'series',''),trim(r->>'opponent'),r->>'venue',trim(r->>'location_name'),trim(r->>'address'),(r->>'scheduled_at')::timestamptz);
   else
     select * into previous from public.matches where id=original_ids[i];
     select coalesce(previous.category,g.name) into previous_category from (select 1) anchor left join public.training_groups g on g.id=previous.group_id;
     if exists(select 1 from public.matches where id=any(original_ids) and home_score is not null) and (r->>'opponent' is distinct from previous.opponent or r->>'venue' is distinct from previous.venue or coalesce(r->>'series','') is distinct from previous.series or trim(r->>'category') is distinct from previous_category) then raise exception 'No se pueden cambiar equipos ni categorías con resultados cargados.'; end if;
     update public.matches set jornada_id=j,activity_id=a,category=trim(r->>'category'),series=coalesce(r->>'series',''),opponent=trim(r->>'opponent'),venue=r->>'venue',location_name=trim(r->>'location_name'),address=trim(r->>'address'),scheduled_at=(r->>'scheduled_at')::timestamptz where id=original_ids[i];
   end if;
   i := i+1;
 end loop;
end; $$;

create or replace function public.save_result(match_id uuid,home integer,away integer,confirm_result boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare m public.matches; begin
 select * into m from public.matches where id=match_id for update;
 if not found or not(private.has_role(array['admin']) or private.manages_group(m.group_id) or private.teaches(m.activity_id)) then raise exception 'Sin permiso para este partido.'; end if;
 if confirm_result and not private.has_role(array['admin']) then raise exception 'Solo administración confirma resultados.'; end if;
 if home is null or away is null then raise exception 'Completá ambos resultados.'; end if;
 update public.matches set home_score=home,away_score=away,status='finalizado',result_status=case when confirm_result then 'confirmado' else 'pendiente' end where id=match_id;
end; $$;

alter table public.rental_agreements alter column instructor_id drop not null;
alter table public.rental_agreements add column contact_name text;
update public.rental_agreements r set contact_name=p.display_name from public.profiles p where p.id=r.instructor_id;
alter table public.rental_agreements alter column contact_name set not null;
alter table public.rental_agreements add constraint rental_contact_name check(length(trim(contact_name)) between 1 and 120);
alter table public.rental_agreements add constraint rental_space check(length(trim(space_name)) between 1 and 150);
alter table public.rental_agreements add constraint rental_schedule check(length(trim(schedule_label)) between 1 and 300);
alter table public.rental_agreements add constraint rental_basis check(length(trim(basis)) between 1 and 200);

create function public.rental_instructors() returns table(id uuid,display_name text,activity_id uuid)
language sql stable security definer set search_path = '' as $$
 select distinct p.id,p.display_name,i.activity_id from public.profiles p join public.instructor_assignments i on i.user_id=p.id
 where private.has_role(array['admin','tesorero']) and i.mode='externo' and i.start_date<=current_date and (i.end_date is null or i.end_date>=current_date)
 and exists(select 1 from public.user_roles r where r.user_id=p.id and r.role='profe');
$$;
create function public.save_rental(agreement jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare target uuid := (agreement->>'id')::uuid; instructor uuid := (agreement->>'instructor_id')::uuid; activity uuid := (agreement->>'activity_id')::uuid; old_row public.rental_agreements;
begin
 if not private.has_role(array['admin','tesorero']) then raise exception 'Solo administración o tesorería puede modificar acuerdos.'; end if;
 select * into old_row from public.rental_agreements where id=target for update;
 if instructor is not null and not (old_row.id is not null and old_row.instructor_id=instructor and old_row.activity_id=activity)
 and not exists(select 1 from public.rental_instructors() d where d.id=instructor and d.activity_id=activity) then raise exception 'La cuenta debe ser un profesor externo de esta actividad.'; end if;
 insert into public.rental_agreements(id,instructor_id,activity_id,contact_name,space_name,schedule_label,amount_cents,basis,active)
 values(target,instructor,activity,trim(agreement->>'contact_name'),trim(agreement->>'space_name'),trim(agreement->>'schedule_label'),(agreement->>'amount_cents')::bigint,trim(agreement->>'basis'),(agreement->>'active')::boolean)
 on conflict(id) do update set instructor_id=excluded.instructor_id,activity_id=excluded.activity_id,contact_name=excluded.contact_name,space_name=excluded.space_name,schedule_label=excluded.schedule_label,amount_cents=excluded.amount_cents,basis=excluded.basis,active=excluded.active;
end; $$;

revoke all on function public.register_student_in_group(text,text,date,uuid,date,uuid),public.add_group_members(uuid,uuid[]),public.save_jornada(jsonb,uuid[]),public.rental_instructors(),public.save_rental(jsonb) from public,anon,authenticated;
grant execute on function public.register_student_in_group(text,text,date,uuid,date,uuid),public.add_group_members(uuid,uuid[]),public.save_jornada(jsonb,uuid[]),public.rental_instructors(),public.save_rental(jsonb) to authenticated;
commit;
