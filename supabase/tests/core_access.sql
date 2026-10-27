-- Ejecutar solo en una base local/de pruebas con las cuatro migraciones aplicadas.
-- Fixture transaccional: ROLLBACK al terminar. No requiere pgTAP.
begin;
insert into auth.users(id,email) values
 ('10000000-0000-0000-0000-000000000001','admin-test@example.invalid'),
 ('10000000-0000-0000-0000-000000000002','profe-test@example.invalid'),
 ('10000000-0000-0000-0000-000000000003','externo-test@example.invalid');
insert into public.profiles(id,display_name) values
 ('10000000-0000-0000-0000-000000000001','Admin prueba'),
 ('10000000-0000-0000-0000-000000000002','Profesor prueba'),
 ('10000000-0000-0000-0000-000000000003','Externo prueba');
insert into public.user_roles values
 ('10000000-0000-0000-0000-000000000001','admin'),
 ('10000000-0000-0000-0000-000000000002','profe'),
 ('10000000-0000-0000-0000-000000000003','profe');
insert into public.activities(id,name,management) values
 ('20000000-0000-0000-0000-000000000001','Actividad test club','club'),
 ('20000000-0000-0000-0000-000000000002','Actividad test externa','externa');
insert into public.instructor_assignments(user_id,activity_id,mode) values
 ('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','interno'),
 ('10000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','externo');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select public.register_student('Alumno','Club','2015-01-01','20000000-0000-0000-0000-000000000001',current_date);
select public.register_student('Alumna','Externa','2014-01-01','20000000-0000-0000-0000-000000000002',current_date);
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
do $$ begin
 if (select count(*) from public.people where last_name in ('Club','Externa')) <> 1 then raise exception 'Falla RLS: profesor ve fichas ajenas'; end if;
 if (select count(*) from public.enrollments) <> 1 then raise exception 'Falla RLS: inscripciones ajenas'; end if;
 begin
  perform public.validate_student((select id from public.people limit 1));
  raise exception 'ERROR_TEST_VALIDACION_PERMITIDA';
 exception when others then
  if sqlerrm='ERROR_TEST_VALIDACION_PERMITIDA' then raise; end if;
 end;
 begin
  insert into public.user_roles values(auth.uid(),'admin');
  raise exception 'ERROR_TEST_ESCALADA_PERMITIDA';
 exception when insufficient_privilege then null;
 end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
select public.register_student('Nueva','Externa','2016-01-01','20000000-0000-0000-0000-000000000002',current_date);
do $$ begin
 if (select count(*) from public.people where last_name='Externa') <> 2 then raise exception 'Falla alta externa'; end if;
 if exists(select 1 from public.people where first_name='Nueva' and validation_status='validada') then raise exception 'Se validó sin admin'; end if;
end $$;
rollback;
