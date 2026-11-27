-- Gestão cadastral pelo responsável principal, com exclusão lógica.
create function private.can_register_vehicle() returns boolean
language sql stable security definer set search_path='' as $$
  select private.active_user() and (private.is_admin() or exists(
    select 1 from public.vehicles where manager_id=(select auth.uid())
  ))
$$;

create function private.vehicle_command(action text, p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid(); eid uuid:=nullif(p->>'id','')::uuid;
  vehicle public.vehicles; manager uuid; photo text; enabled boolean;
  before_row jsonb; after_row jsonb;
begin
  if uid is null or not private.active_user() then
    raise exception 'Acesso não autorizado ou usuário inativo.';
  end if;
  perform pg_advisory_xact_lock(742019261);
  if action not in ('save_vehicle','delete_vehicle') or action is null then
    raise exception 'Ação desconhecida.';
  end if;
  if eid is not null then
    select * into vehicle from public.vehicles where id=eid for update;
    if not found then raise exception 'Carro não encontrado.'; end if;
    if not private.is_admin() and vehicle.manager_id<>uid then
      raise exception 'Somente o responsável principal pode gerenciar este carro.';
    end if;
    before_row:=to_jsonb(vehicle);
  elsif action='delete_vehicle' then
    raise exception 'Escolha o carro que deseja excluir.';
  elsif not private.can_register_vehicle() then
    raise exception 'Somente o administrador ou um responsável principal pode cadastrar carros.';
  end if;

  enabled:=case when action='delete_vehicle' then false else coalesce((p->>'active')::boolean,true) end;
  if eid is not null and vehicle.active and not enabled then
    if exists(select 1 from public.reservations where vehicle_id=eid and status in ('approved','in_progress'))
      or exists(select 1 from public.candidates c join public.requests r on r.id=c.request_id
        where c.vehicle_id=eid and c.status='pending' and r.status='pending')
      or exists(select 1 from public.series where vehicle_id=eid and active) then
      raise exception 'Resolva as solicitações pendentes, viagens abertas e recorrências antes de excluir ou inativar o carro.';
    end if;
  end if;

  if action='delete_vehicle' then
    update public.vehicles set active=false where id=eid returning to_jsonb(vehicles.*) into after_row;
  else
    manager:=nullif(p->>'manager_id','')::uuid;
    if not private.is_admin() then
      if manager is not null and manager<>uid then
        raise exception 'O carro deve permanecer vinculado ao próprio responsável principal.';
      end if;
      manager:=uid;
    end if;
    if trim(coalesce(p->>'name',''))='' or trim(coalesce(p->>'model',''))='' or trim(coalesce(p->>'plate',''))='' then
      raise exception 'Preencha nome, modelo e placa.';
    end if;
    if not exists(select 1 from public.profiles where id=manager and active) then
      raise exception 'Escolha um responsável principal ativo.';
    end if;
    if not exists(select 1 from public.units where id=(p->>'unit_id')::uuid and (active or id=vehicle.unit_id)) then
      raise exception 'Escolha uma unidade ativa.';
    end if;
    photo:=p->>'photo_path';
    if photo is null or not exists(select 1 from storage.objects where bucket_id='vehicle-photos' and name=photo)
      or (photo is distinct from vehicle.photo_path and split_part(photo,'/',1)<>uid::text) then
      raise exception 'Envie a foto do carro antes de salvar.';
    end if;
    if eid is null then
      insert into public.vehicles(name,model,plate,unit_id,manager_id,photo_path,color,active)
      values(trim(p->>'name'),trim(p->>'model'),upper(trim(p->>'plate')),(p->>'unit_id')::uuid,
        manager,photo,coalesce(p->>'color','#01478d'),enabled)
      returning id,to_jsonb(vehicles.*) into eid,after_row;
    else
      update public.vehicles set name=trim(p->>'name'),model=trim(p->>'model'),plate=upper(trim(p->>'plate')),
        unit_id=(p->>'unit_id')::uuid,manager_id=manager,photo_path=photo,
        color=coalesce(p->>'color',color),active=enabled where id=eid
      returning to_jsonb(vehicles.*) into after_row;
    end if;
  end if;
  insert into public.audit_log(actor_id,action,entity_id,before_data,after_data)
    values(uid,action,eid,before_row,after_row);
  return jsonb_build_object('id',eid);
end $$;

create or replace function public.app_command(action text, payload jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$
  select case when action in ('save_vehicle','delete_vehicle')
    then private.vehicle_command(action,payload)
    else private.command(action,payload) end
$$;

drop policy vehicle_photos_insert on storage.objects;
create policy vehicle_photos_insert on storage.objects for insert to authenticated
with check(bucket_id='vehicle-photos' and private.can_register_vehicle()
  and split_part(name,'/',1)=(select auth.uid())::text);

revoke all on function private.can_register_vehicle(),private.vehicle_command(text,jsonb) from public,anon,authenticated;
grant execute on function private.can_register_vehicle(),private.vehicle_command(text,jsonb) to authenticated;
