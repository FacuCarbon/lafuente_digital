-- Requiere las cuatro migraciones. Ejecutar únicamente en una base de pruebas.
-- No requiere pgTAP. Revierte fixtures y operaciones al terminar.
begin;
insert into auth.users(id,email) values
 ('11000000-0000-0000-0000-000000000001','ux-admin@example.invalid'),
 ('11000000-0000-0000-0000-000000000002','ux-profe@example.invalid'),
 ('11000000-0000-0000-0000-000000000003','ux-tesoreria@example.invalid');
insert into public.profiles values
 ('11000000-0000-0000-0000-000000000001','Admin UX'),
 ('11000000-0000-0000-0000-000000000002','Profesor UX'),
 ('11000000-0000-0000-0000-000000000003','Tesorería UX');
insert into public.user_roles values
 ('11000000-0000-0000-0000-000000000001','admin'),
 ('11000000-0000-0000-0000-000000000002','profe'),
 ('11000000-0000-0000-0000-000000000003','tesorero');
insert into public.activities(id,name,management) values('22000000-0000-0000-0000-000000000001','Actividad UX','externa');
insert into public.instructor_assignments(user_id,activity_id,mode) values('11000000-0000-0000-0000-000000000002','22000000-0000-0000-0000-000000000001','externo');
insert into public.training_groups(id,activity_id,season,name) values('33000000-0000-0000-0000-000000000001','22000000-0000-0000-0000-000000000001',2026,'Entrenamiento UX');
set local role authenticated;
select set_config('request.jwt.claim.sub','11000000-0000-0000-0000-000000000001',true);
select public.register_student_in_group('Alta','Directa','2015-01-01','22000000-0000-0000-0000-000000000001',current_date,'33000000-0000-0000-0000-000000000001');
do $$ begin
 if not exists(select 1 from public.people p join public.enrollments e on e.person_id=p.id join public.group_members gm on gm.enrollment_id=e.id where p.first_name='Alta' and p.validation_status='validada' and e.status='activa') then raise exception 'Alta admin requiere otro paso'; end if;
end $$;

-- Cuatro categorías, una jornada, sin grupos competitivos ficticios.
select public.save_jornada((select jsonb_agg(jsonb_build_object(
 'id',gen_random_uuid(),'jornada_id','44000000-0000-0000-0000-000000000001','activity_id','22000000-0000-0000-0000-000000000001',
 'category','Categoría '||n,'series','Blanca','opponent','Rival UX','venue','local',
 'location_name','Club San Martín','address','Barragán 4601, Remedios de Escalada.',
 'scheduled_at',timestamptz '2026-11-07 08:50:00-03'+n*interval '50 minutes')) from generate_series(1,4) n));
do $$ declare rows jsonb; ids uuid[]; begin
 if (select count(*) from public.matches where jornada_id='44000000-0000-0000-0000-000000000001' and group_id is null)<>4 then raise exception 'Se perdieron categorías'; end if;
 -- Un error en la última categoría no debe dejar los primeros partidos insertados.
 select jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'jornada_id','44000000-0000-0000-0000-000000000002','activity_id','22000000-0000-0000-0000-000000000001',
 'category','Categoría '||n,'series','Rojo','opponent','Rival UX','venue','local','location_name','Club La Fuente','address',case when n=2 then '' else 'Dr. A Melo 3951' end,'scheduled_at','2026-11-07T09:00:00-03:00')) into rows from generate_series(1,2) n;
 begin
  perform public.save_jornada(rows);
  raise exception 'TEST_JORNADA_INVALIDA_PERMITIDA';
 exception when others then if sqlerrm='TEST_JORNADA_INVALIDA_PERMITIDA' then raise; end if; end;
 if exists(select 1 from public.matches where jornada_id='44000000-0000-0000-0000-000000000002') then raise exception 'Jornada parcialmente guardada'; end if;
 select array_agg(id order by category) into ids from public.matches where jornada_id='44000000-0000-0000-0000-000000000001';
 perform public.save_result(ids[1],0,0,true);
 select jsonb_agg(to_jsonb(m)||jsonb_build_object('address','Dirección corregida') order by category) into rows from public.matches m where m.id=any(ids);
 perform public.save_jornada(rows,ids);
 if not exists(select 1 from public.matches where id=ids[1] and home_score=0 and away_score=0 and result_status='confirmado' and address='Dirección corregida') then raise exception 'La edición perdió el resultado'; end if;
 rows := jsonb_set(rows,'{0,venue}','"visitante"');
 begin perform public.save_jornada(rows,ids); raise exception 'TEST_CAMBIO_EQUIPOS_PERMITIDO';
 exception when others then if sqlerrm='TEST_CAMBIO_EQUIPOS_PERMITIDO' then raise; end if; end;
end $$;

select set_config('request.jwt.claim.sub','11000000-0000-0000-0000-000000000003',true);
select public.save_rental(jsonb_build_object('id','55000000-0000-0000-0000-000000000001','instructor_id','11000000-0000-0000-0000-000000000002','activity_id','22000000-0000-0000-0000-000000000001','contact_name','Profesor UX','space_name','Salón UX','schedule_label','Lunes 18 a 19','amount_cents',5000000,'basis','Por mes','active',true));
select public.save_rental(jsonb_build_object('id','55000000-0000-0000-0000-000000000002','instructor_id',null,'activity_id','22000000-0000-0000-0000-000000000001','contact_name','Sin cuenta','space_name','Cancha UX','schedule_label','Viernes 18 a 19','amount_cents',null,'basis','A acordar','active',true));
do $$ begin
 if (select count(*) from public.rental_agreements where space_name like '%UX')<>2 then raise exception 'Tesorería no puede guardar alquileres'; end if;
 if (select count(*) from public.rental_instructors() where activity_id='22000000-0000-0000-0000-000000000001')<>1 then raise exception 'Falla directorio de profesores externos'; end if;
end $$;

select set_config('request.jwt.claim.sub','11000000-0000-0000-0000-000000000002',true);
select public.register_student('Alta','Externa UX','2015-01-01','22000000-0000-0000-0000-000000000001',current_date);
do $$ declare match_id uuid; begin
 if not exists(select 1 from public.people where last_name='Externa UX' and validation_status='pendiente') then raise exception 'Alta externa se aprobó sola'; end if;
 if (select count(*) from public.rental_agreements where space_name like '%UX')<>1 then raise exception 'Profesor ve alquiler ajeno'; end if;
 if exists(select 1 from public.rental_instructors()) then raise exception 'Profesor ve directorio privado'; end if;
 select id into match_id from public.matches where jornada_id='44000000-0000-0000-0000-000000000001' order by category desc limit 1;
 perform public.save_result(match_id,1,2,false);
 begin perform public.save_result(match_id,1,2,true); raise exception 'TEST_CONFIRMACION_PERMITIDA';
 exception when others then if sqlerrm='TEST_CONFIRMACION_PERMITIDA' then raise; end if; end;
 begin perform public.save_rental('{}'); raise exception 'TEST_ALQUILER_PERMITIDO';
 exception when others then if sqlerrm='TEST_ALQUILER_PERMITIDO' then raise; end if; end;
 begin perform public.save_jornada('[]'); raise exception 'TEST_JORNADA_PERMITIDA';
 exception when others then if sqlerrm='TEST_JORNADA_PERMITIDA' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','11000000-0000-0000-0000-000000000001',true);
do $$ declare activity jsonb; agreement jsonb; begin
 activity := jsonb_build_object('id','66000000-0000-0000-0000-000000000001','name','Actividad unificada UX','management','externa','status','activa','description','','color','#1360b3','schedule_label','Lunes 18 a 19');
 agreement := jsonb_build_object('id','77000000-0000-0000-0000-000000000001','activity_id','66000000-0000-0000-0000-000000000001','instructor_id',null,'contact_name','','space_name','Salón','schedule_label','Lunes 18 a 19','amount_cents',null,'basis','Por mes','active',true);
 begin perform public.save_activity_setup(activity,agreement); raise exception 'TEST_ACUERDO_INCOMPLETO_PERMITIDO';
 exception when others then if sqlerrm='TEST_ACUERDO_INCOMPLETO_PERMITIDO' then raise; end if; end;
 if exists(select 1 from public.activities where id='66000000-0000-0000-0000-000000000001') then raise exception 'Actividad creada parcialmente'; end if;
 agreement := jsonb_set(agreement,'{contact_name}','"Responsable sin cuenta"');
 perform public.save_activity_setup(activity,agreement);
 if not exists(select 1 from public.rental_agreements where id='77000000-0000-0000-0000-000000000001' and active) then raise exception 'No se creó el acuerdo junto con la actividad'; end if;
 activity := jsonb_set(activity,'{schedule_slots}','[{"id":"slot1","label":"2019 / 2020","days":[2,5],"start":"18:00","end":""}]');
 perform public.save_activity_setup(activity,agreement);
 if (select jsonb_array_length(schedule_slots) from public.activities where id='66000000-0000-0000-0000-000000000001')<>1 then raise exception 'No se guardó el bloque horario'; end if;
 begin
  perform public.save_activity_setup(jsonb_set(activity,'{schedule_slots,0,days}','[0]'),agreement);
  raise exception 'TEST_DIA_INVALIDO_PERMITIDO';
 exception when others then if sqlerrm='TEST_DIA_INVALIDO_PERMITIDO' then raise; end if; end;
 if (select schedule_slots->0->'days' from public.activities where id='66000000-0000-0000-0000-000000000001')<>'[2,5]'::jsonb then raise exception 'El error alteró los horarios guardados'; end if;
 perform public.save_activity_setup(jsonb_set(activity,'{management}','"club"'),null);
 if not exists(select 1 from public.rental_agreements where id='77000000-0000-0000-0000-000000000001' and not active) then raise exception 'Se perdió el historial al cambiar modalidad'; end if;
end $$;
select set_config('request.jwt.claim.sub','11000000-0000-0000-0000-000000000002',true);
do $$ begin
 begin perform public.save_activity_setup('{}',null); raise exception 'TEST_CONFIGURACION_EXTERNA_PERMITIDA';
 exception when others then if sqlerrm='TEST_CONFIGURACION_EXTERNA_PERMITIDA' then raise; end if; end;
end $$;
rollback;
