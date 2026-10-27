begin;
alter table public.activities add column schedule_slots jsonb not null default '[]'::jsonb;
alter table public.activities add constraint activity_slots_array check(jsonb_typeof(schedule_slots)='array' and jsonb_array_length(schedule_slots)<=40);
alter table public.activities drop constraint activities_schedule_label_check;
alter table public.activities add constraint activity_schedule_summary check(length(schedule_label)<=10000);
alter table public.rental_agreements drop constraint rental_schedule;
alter table public.rental_agreements add constraint rental_schedule check(length(trim(schedule_label)) between 1 and 10000);

create function private.check_activity_slots() returns trigger language plpgsql set search_path='' as $$
declare s jsonb; d jsonb; begin
 if jsonb_typeof(new.schedule_slots) is distinct from 'array' or jsonb_array_length(new.schedule_slots)>40 then raise exception 'Horarios inválidos.'; end if;
 for s in select value from jsonb_array_elements(new.schedule_slots) loop
  if jsonb_typeof(s) is distinct from 'object' or coalesce(length(trim(s->>'id')),0) not between 1 and 100
   or jsonb_typeof(s->'label') is distinct from 'string' or coalesce(length(trim(s->>'label')),0) not between 1 and 100
   or jsonb_typeof(s->'days') is distinct from 'array' then raise exception 'Completá categoría y días de cada bloque.'; end if;
  if jsonb_array_length(s->'days') not between 1 and 7 or coalesce(s->>'start','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
   or (coalesce(s->>'end','')<>'' and ((s->>'end') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or (s->>'end')<=(s->>'start'))) then raise exception 'Revisá días y horas de cada bloque.'; end if;
  for d in select value from jsonb_array_elements(s->'days') loop
   if jsonb_typeof(d)<>'number' or d::text !~ '^[1-7]$' then raise exception 'Día inválido.'; end if;
  end loop;
  if (select count(distinct value) from jsonb_array_elements(s->'days'))<>jsonb_array_length(s->'days') then raise exception 'Días repetidos.'; end if;
 end loop;
 if (select count(distinct value->>'id') from jsonb_array_elements(new.schedule_slots))<>jsonb_array_length(new.schedule_slots) then raise exception 'Bloques repetidos.'; end if;
 if exists(select 1 from jsonb_array_elements(new.schedule_slots) s cross join lateral jsonb_array_elements(s->'days') d group by lower(trim(s->>'label')),d,s->>'start' having count(*)>1) then raise exception 'Horario repetido para el mismo grupo y día.'; end if;
 return new;
end; $$;
revoke all on function private.check_activity_slots() from public,anon,authenticated;
create trigger check_activity_slots before insert or update of schedule_slots on public.activities for each row execute function private.check_activity_slots();

create or replace function public.save_activity_setup(activity jsonb,agreement jsonb default null) returns void
language plpgsql security definer set search_path = '' as $$
declare target uuid := (activity->>'id')::uuid; old_mode text; new_mode text := activity->>'management'; rental_id uuid; slots jsonb := coalesce(activity->'schedule_slots','[]'::jsonb);
begin
 if not private.has_role(array['admin']) then raise exception 'Solo administración puede configurar actividades.'; end if;
 select management into old_mode from public.activities where id=target for update;
 if new_mode='externa' then
   if agreement is null or agreement='null'::jsonb or (agreement->>'activity_id')::uuid is distinct from target then raise exception 'Completá el acuerdo de la actividad externa.'; end if;
   if coalesce(trim(activity->>'schedule_label'),'')='' or agreement->>'schedule_label' is distinct from activity->>'schedule_label' then raise exception 'Completá días y horarios de la actividad.'; end if;
   rental_id := (agreement->>'id')::uuid;
   if exists(select 1 from public.rental_agreements where id=rental_id and activity_id<>target) then raise exception 'El acuerdo pertenece a otra actividad.'; end if;
 elsif agreement is not null and agreement<>'null'::jsonb then
   raise exception 'Una actividad del club no necesita un nuevo acuerdo externo.';
 end if;
 insert into public.activities(id,name,management,status,description,color,schedule_label,schedule_slots)
 values(target,trim(activity->>'name'),new_mode,activity->>'status',coalesce(activity->>'description',''),activity->>'color',coalesce(activity->>'schedule_label',''),slots)
 on conflict(id) do update set name=excluded.name,management=excluded.management,status=excluded.status,description=excluded.description,color=excluded.color,schedule_label=excluded.schedule_label,schedule_slots=excluded.schedule_slots;
 if new_mode='externa' then perform public.save_rental(agreement);
 elsif old_mode='externa' and new_mode='club' then
   update public.rental_agreements set active=false where activity_id=target and active;
 end if;
end; $$;
-- Los horarios anteriores se conservan como texto; no se infieren categorías ni horas.
commit;
