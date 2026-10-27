-- Una entrada de UX para actividad y acuerdo; datos económicos con RLS separada.
begin;
alter table public.activities add column schedule_label text not null default '' check(length(schedule_label)<=300);
-- Solo trasladar un horario existente cuando no hay ambigüedad entre acuerdos.
update public.activities a set schedule_label=r.schedule_label from public.rental_agreements r
where r.activity_id=a.id and r.active and (select count(*) from public.rental_agreements other where other.activity_id=a.id and other.active)=1;

create function public.save_activity_setup(activity jsonb,agreement jsonb default null) returns void
language plpgsql security definer set search_path = '' as $$
declare target uuid := (activity->>'id')::uuid; old_mode text; new_mode text := activity->>'management'; rental_id uuid;
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
 insert into public.activities(id,name,management,status,description,color,schedule_label)
 values(target,trim(activity->>'name'),new_mode,activity->>'status',coalesce(activity->>'description',''),activity->>'color',coalesce(activity->>'schedule_label',''))
 on conflict(id) do update set name=excluded.name,management=excluded.management,status=excluded.status,description=excluded.description,color=excluded.color,schedule_label=excluded.schedule_label;
 if new_mode='externa' then perform public.save_rental(agreement);
 elsif old_mode='externa' and new_mode='club' then
   update public.rental_agreements set active=false where activity_id=target and active;
 end if;
end; $$;
revoke insert,update on public.activities from authenticated;
revoke all on function public.save_activity_setup(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_activity_setup(jsonb,jsonb) to authenticated;
commit;
