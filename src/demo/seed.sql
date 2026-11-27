insert into public.units(id,name,kind) values
 ('10000000-0000-4000-8000-000000000001','Edições Shalom','sector'),
 ('10000000-0000-4000-8000-000000000002','Casa comunitária 1','house'),
 ('10000000-0000-4000-8000-000000000003','Casa comunitária 2','house'),
 ('10000000-0000-4000-8000-000000000004','Casa comunitária 3','house'),
 ('10000000-0000-4000-8000-000000000005','Casa comunitária 4','house'),
 ('10000000-0000-4000-8000-000000000006','Casa comunitária 5','house'),
 ('10000000-0000-4000-8000-000000000007','Casa comunitária 6','house');
insert into auth.users(id,email,raw_user_meta_data) values
 ('20000000-0000-4000-8000-000000000001','motorista@exemplo.org','{"full_name":"Ana Oliveira","phone":"85999990001"}'),
 ('20000000-0000-4000-8000-000000000002','responsavel@exemplo.org','{"full_name":"Pedro Santos","phone":"85999990002"}'),
 ('20000000-0000-4000-8000-000000000003','admin@exemplo.org','{"full_name":"Maria Souza","phone":"85999990003"}'),
 ('20000000-0000-4000-8000-000000000004','outro@exemplo.org','{"full_name":"Lucas Costa","phone":"85999990004"}');
update public.profiles set unit_id='10000000-0000-4000-8000-000000000001';
update public.profiles set is_admin=true where id='20000000-0000-4000-8000-000000000003';
insert into public.vehicles(id,name,model,plate,unit_id,manager_id,color) values
 ('30000000-0000-4000-8000-000000000001','Carro 01','Fiat Argo · demonstração','DEMO001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','#01478d'),
 ('30000000-0000-4000-8000-000000000002','Carro 02','Chevrolet Onix · demonstração','DEMO002','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000004','#47776b');
insert into public.requests(id,driver_id,destination,starts_at,ends_at,mode) values
 ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Livraria Shalom',now()+interval '1 day',now()+interval '1 day 3 hours','specific');
insert into public.candidates(request_id,vehicle_id) values('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001');
insert into public.reservations(id,driver_id,vehicle_id,destination,starts_at,ends_at) values
 ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Centro de evangelização',now()+interval '2 days',now()+interval '2 days 2 hours'),
 ('50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000002','Destino privado de outro motorista',now()+interval '3 days',now()+interval '3 days 2 hours');
insert into public.reservations(id,driver_id,vehicle_id,destination,starts_at,ends_at,status,actual_start,actual_end,km_out,km_in,departure_by,return_by,no_incidents) values
 ('50000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Distribuição de livros',now()-interval '3 days',now()-interval '3 days'+interval '3 hours','completed',now()-interval '3 days',now()-interval '3 days'+interval '2 hours',12450,12482,'20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',true);
insert into public.notifications(user_id,title,body,entity_id,entity_type,dedupe_key) values
 ('20000000-0000-4000-8000-000000000001','Sua reserva está confirmada','Confira os detalhes e registre a retirada ao sair.','50000000-0000-4000-8000-000000000001','trip','demo-approved'),
 ('20000000-0000-4000-8000-000000000002','Nova solicitação','Ana solicitou um carro para a Livraria Shalom.','40000000-0000-4000-8000-000000000001','request','demo-pending');
