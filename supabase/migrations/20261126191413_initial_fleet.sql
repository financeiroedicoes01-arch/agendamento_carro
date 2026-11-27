-- Fonte da migração inicial. Mutações operacionais passam por comandos atômicos.
create extension if not exists btree_gist;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create table public.settings (
  id boolean primary key default true check (id),
  timezone text not null default 'America/Sao_Paulo',
  recurrence_horizon integer not null default 90 check (recurrence_horizon between 7 and 366)
);
insert into public.settings default values;
create table public.units (
  id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) > 0),
  kind text not null check(kind in ('sector','house')), active boolean not null default true
);
create table public.profiles (
  id uuid primary key references auth.users(id), full_name text not null,
  email text not null, phone text not null default '', unit_id uuid references public.units,
  is_admin boolean not null default false, active boolean not null default true
);
create table public.vehicles (
  id uuid primary key default gen_random_uuid(), name text not null, model text not null,
  plate text not null unique, unit_id uuid not null references public.units,
  manager_id uuid not null references public.profiles, photo_path text,
  color text not null default '#912c3a', active boolean not null default true
);
create table public.assignments (
  id uuid primary key default gen_random_uuid(), vehicle_id uuid not null references public.vehicles,
  user_id uuid not null references public.profiles, starts_at timestamptz not null,
  ends_at timestamptz not null, created_by uuid not null references public.profiles,
  check(ends_at > starts_at)
);
create table public.requests (
  id uuid primary key default gen_random_uuid(), driver_id uuid not null references public.profiles,
  destination text not null check(length(trim(destination)) > 0),
  starts_at timestamptz not null, ends_at timestamptz not null,
  mode text not null check(mode in ('specific','any')),
  status text not null default 'pending' check(status in ('pending','approved','rejected','expired','cancelled')),
  created_at timestamptz not null default now(), check(ends_at > starts_at)
);
create table public.candidates (
  id uuid primary key default gen_random_uuid(), request_id uuid not null references public.requests,
  vehicle_id uuid not null references public.vehicles,
  status text not null default 'pending' check(status in ('pending','approved','rejected','closed','unavailable')),
  decided_by uuid references public.profiles, decided_at timestamptz, reason text,
  unique(request_id, vehicle_id)
);
create table public.series (
  id uuid primary key default gen_random_uuid(), driver_id uuid not null references public.profiles,
  vehicle_id uuid not null references public.vehicles, destination text not null,
  start_date date not null, end_date date, start_time time not null, end_time time not null,
  day_span integer not null default 0 check(day_span >= 0),
  frequency text not null check(frequency in ('daily','weekly','fortnightly','monthly')),
  weekdays integer[] not null default '{}', active boolean not null default true,
  generated_until date, check(end_date is null or end_date >= start_date),
  check(weekdays <@ array[0,1,2,3,4,5,6]),
  check(frequency<>'weekly' or cardinality(weekdays)>0),
  check(day_span > 0 or end_time > start_time)
);
create table public.reservations (
  id uuid primary key default gen_random_uuid(), request_id uuid unique references public.requests,
  series_id uuid references public.series, occurrence_date date,
  driver_id uuid not null references public.profiles, vehicle_id uuid not null references public.vehicles,
  destination text not null, starts_at timestamptz not null, ends_at timestamptz not null,
  status text not null default 'approved' check(status in ('approved','in_progress','completed','cancelled')),
  actual_start timestamptz, actual_end timestamptz, km_out numeric(12,1), km_in numeric(12,1),
  departure_by uuid references public.profiles, return_by uuid references public.profiles,
  departure_note text, return_note text, no_incidents boolean,
  created_at timestamptz not null default now(), check(ends_at > starts_at),
  check(km_out is null or km_out >= 0), check(km_in is null or km_in >= km_out),
  check(actual_end is null or actual_end >= actual_start),
  unique(series_id, occurrence_date),
  exclude using gist (vehicle_id with =, tstzrange(least(starts_at,coalesce(actual_start,starts_at)),ends_at,'[)') with &&)
    where (status in ('approved','in_progress')),
  exclude using gist (driver_id with =, tstzrange(least(starts_at,coalesce(actual_start,starts_at)),ends_at,'[)') with &&)
    where (status in ('approved','in_progress'))
);
create table public.changes (
  id uuid primary key default gen_random_uuid(), reservation_id uuid not null references public.reservations,
  destination text not null, starts_at timestamptz not null, ends_at timestamptz not null,
  kind text not null check(kind in ('change','extension')),
  status text not null default 'pending' check(status in ('pending','approved','rejected','expired')),
  created_by uuid not null references public.profiles, decided_by uuid references public.profiles,
  created_at timestamptz not null default now(), check(ends_at > starts_at)
);
create unique index one_pending_change on public.changes(reservation_id) where status='pending';
create table public.blocks (
  id uuid primary key default gen_random_uuid(), vehicle_id uuid not null references public.vehicles,
  starts_at timestamptz not null, ends_at timestamptz, reason text not null,
  created_by uuid not null references public.profiles, released_at timestamptz,
  check(ends_at is null or ends_at > starts_at)
);
create table public.fuels (
  id uuid primary key default gen_random_uuid(), reservation_id uuid not null references public.reservations,
  amount numeric(12,2) not null check(amount > 0), receipt_path text not null
);
create table public.incidents (
  id uuid primary key default gen_random_uuid(), reservation_id uuid not null references public.reservations,
  kind text not null check(kind in ('problem','accident')), description text not null check(length(trim(description)) > 0),
  occurred_at timestamptz not null, location text not null check(length(trim(location)) > 0),
  photos text[] not null check(cardinality(photos) > 0),
  status text not null default 'pending' check(status in ('pending','in_resolution','resolved')),
  measures text not null default '', updated_by uuid references public.profiles,
  created_at timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles,
  title text not null, body text not null, entity_id uuid, entity_type text not null default 'trip',
  dedupe_key text not null, read_at timestamptz, created_at timestamptz not null default now(),
  push_sent_at timestamptz, push_claimed_at timestamptz, unique(user_id,dedupe_key)
);
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles,
  endpoint text not null unique, subscription jsonb not null, created_at timestamptz not null default now()
);
create table public.push_deliveries (
  notification_id uuid not null references public.notifications,
  subscription_id uuid not null,
  delivered_at timestamptz not null default now(),
  primary key(notification_id,subscription_id)
);
alter table public.push_deliveries enable row level security;
revoke all on public.push_deliveries from public, anon, authenticated;
grant all on public.push_deliveries to service_role;
create table public.audit_log (
  id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles,
  action text not null, entity_id uuid, before_data jsonb, after_data jsonb,
  created_at timestamptz not null default now()
);
create index assignments_user_period on public.assignments(user_id, starts_at, ends_at);
create index assignments_vehicle on public.assignments(vehicle_id);
create index requests_driver on public.requests(driver_id,status);
create index candidates_vehicle on public.candidates(vehicle_id,status);
create index reservations_vehicle on public.reservations(vehicle_id,starts_at);
create index reservations_driver on public.reservations(driver_id,starts_at);
create index reservations_series on public.reservations(series_id);
create index changes_reservation on public.changes(reservation_id,status);
create index blocks_vehicle on public.blocks(vehicle_id,starts_at);
create index incidents_trip on public.incidents(reservation_id);
create index fuels_trip on public.fuels(reservation_id);
create index notifications_user on public.notifications(user_id,created_at desc);
create index notifications_unsent on public.notifications(created_at) where push_sent_at is null;
create index subscriptions_user on public.push_subscriptions(user_id);
create index vehicles_manager on public.vehicles(manager_id);
create index profiles_unit on public.profiles(unit_id);
create index vehicles_unit on public.vehicles(unit_id);

create function private.active_user() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles where id=(select auth.uid()) and active)
$$;
create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles where id=(select auth.uid()) and active and is_admin)
$$;
create function private.manages(v uuid, u uuid default auth.uid()) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles where id=u and active) and (
    exists(select 1 from public.vehicles where id=v and manager_id=u)
    or exists(select 1 from public.assignments where vehicle_id=v and user_id=u and starts_at<=now() and ends_at>now()))
$$;
create function private.trip_access(t uuid) returns boolean language sql stable security definer set search_path='' as $$
  select private.active_user() and exists(select 1 from public.reservations where id=t and (driver_id=auth.uid() or private.manages(vehicle_id)))
$$;
create function private.request_access(r uuid) returns boolean language sql stable security definer set search_path='' as $$
  select private.active_user() and (exists(select 1 from public.requests where id=r and driver_id=auth.uid())
    or exists(select 1 from public.candidates where request_id=r and private.manages(vehicle_id)))
$$;
create function private.profile_access(u uuid) returns boolean language sql stable security definer set search_path='' as $$
  select private.active_user() and (u=auth.uid() or private.is_admin()
    or exists(select 1 from public.reservations where driver_id=u and private.manages(vehicle_id))
    or exists(select 1 from public.requests r join public.candidates c on c.request_id=r.id where r.driver_id=u and private.manages(c.vehicle_id)))
$$;
create function private.new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,full_name,email,phone)
  values(new.id, coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name',''),coalesce(new.email,''),coalesce(new.raw_user_meta_data->>'phone',''));
  return new;
end $$;
create trigger create_profile after insert on auth.users for each row execute function private.new_user();

-- Nenhuma escrita direta para clientes. Mesmo administradores usam comandos validados.
do $$ declare t text; begin
  foreach t in array array['settings','units','profiles','vehicles','assignments','requests','candidates','series','reservations','changes','blocks','fuels','incidents','notifications','push_subscriptions','audit_log'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;
create policy read_settings on public.settings for select to authenticated using(private.active_user());
create policy read_units on public.units for select to authenticated using(private.active_user());
create policy read_profiles on public.profiles for select to authenticated using(private.profile_access(id));
create policy read_vehicles on public.vehicles for select to authenticated using(private.active_user());
create policy read_assignments on public.assignments for select to authenticated using(private.active_user() and (user_id=auth.uid() or private.manages(vehicle_id) or private.is_admin()));
create policy read_requests on public.requests for select to authenticated using(private.request_access(id));
-- Um responsável de A não enxerga as decisões individuais de B.
create policy read_candidates on public.candidates for select to authenticated using(private.active_user() and (private.manages(vehicle_id) or exists(select 1 from public.requests where id=request_id and driver_id=auth.uid())));
create policy read_trips on public.reservations for select to authenticated using(private.trip_access(id));
create policy read_changes on public.changes for select to authenticated using(private.trip_access(reservation_id));
create policy read_series on public.series for select to authenticated using(private.active_user() and (driver_id=auth.uid() or private.manages(vehicle_id)));
create policy read_blocks on public.blocks for select to authenticated using(private.active_user() and private.manages(vehicle_id));
create policy read_fuels on public.fuels for select to authenticated using(private.trip_access(reservation_id));
create policy read_incidents on public.incidents for select to authenticated using(private.trip_access(reservation_id));
create policy read_notifications on public.notifications for select to authenticated using(private.active_user() and user_id=auth.uid());
create policy read_push on public.push_subscriptions for select to authenticated using(private.active_user() and user_id=auth.uid());
create policy read_audit on public.audit_log for select to authenticated using(private.active_user() and (actor_id=auth.uid() or private.trip_access(entity_id) or private.request_access(entity_id)));

create function private.notify(u uuid, title text, body text, entity uuid, kind text, key text) returns void
language sql security definer set search_path='' as $$
  insert into public.notifications(user_id,title,body,entity_id,entity_type,dedupe_key)
  values(u,title,body,entity,kind,key) on conflict(user_id,dedupe_key) do nothing
$$;
create function private.notify_managers(v uuid, title text, body text, entity uuid, kind text, key text) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid; begin
  for u in select manager_id from public.vehicles where id=v union select user_id from public.assignments where vehicle_id=v and starts_at<=now() and ends_at>now() loop
    perform private.notify(u,title,body,entity,kind,key);
  end loop;
end $$;
create function private.assert_available(v uuid, d uuid, s timestamptz, e timestamptz, ignored uuid default null) returns void
language plpgsql security definer set search_path='' as $$
begin
  if s is null or e is null or e<=s then raise exception 'Informe um período válido.'; end if;
  if not exists(select 1 from public.vehicles where id=v and (active or ignored is not null)) then raise exception 'Veículo indisponível.'; end if;
  if not exists(select 1 from public.profiles where id=d and active) then raise exception 'Motorista inativo.'; end if;
  if exists(select 1 from public.reservations where id is distinct from ignored and status in ('approved','in_progress') and (vehicle_id=v or driver_id=d) and tstzrange(least(starts_at,coalesce(actual_start,starts_at)),ends_at,'[)') && tstzrange(s,e,'[)')) then
    raise exception 'Conflito: o veículo ou o motorista já tem uma reserva nesse período.';
  end if;
  if exists(select 1 from public.blocks where vehicle_id=v and released_at is null and tstzrange(starts_at,ends_at,'[)') && tstzrange(s,e,'[)')) then
    raise exception 'O veículo está bloqueado por manutenção nesse período.';
  end if;
end $$;
create function private.finish_unavailable() returns void language plpgsql security definer set search_path='' as $$
declare r record; begin
  for r in select * from public.requests q where status='pending' and not exists(select 1 from public.candidates where request_id=q.id and status='pending') loop
    update public.requests set status='rejected' where id=r.id;
    perform private.notify(r.driver_id,'Solicitação não aprovada','Nenhum dos veículos candidatos pôde confirmar sua solicitação.',r.id,'request','rejected:'||r.id);
  end loop;
end $$;
create function private.close_conflicts(v uuid, s timestamptz, e timestamptz) returns void language plpgsql security definer set search_path='' as $$
begin
  update public.candidates c set status='unavailable',decided_at=now()
  from public.requests r where c.request_id=r.id and r.status='pending' and c.vehicle_id=v and c.status='pending'
  and tstzrange(r.starts_at,r.ends_at,'[)') && tstzrange(s,e,'[)');
  perform private.finish_unavailable();
end $$;

-- Calendário sanitizado: detalhes de terceiros nunca são retornados por este endpoint.
create function private.calendar() returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(x),'[]') from (
    select id,vehicle_id,least(starts_at,coalesce(actual_start,starts_at)) as starts_at,
      case when status='completed' then actual_end else ends_at end as ends_at,
      case when status='completed' then 'history' else 'reservation' end as kind,
      case when driver_id=auth.uid() or private.manages(vehicle_id) then id else null end as reservation_id
    from public.reservations where private.active_user() and status in ('approved','in_progress','completed')
    union all
    select id,vehicle_id,starts_at,coalesce(ends_at,'infinity'::timestamptz),'maintenance',null::uuid
    from public.blocks where private.active_user() and released_at is null
  ) x
$$;
create function private.directory() returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'full_name',full_name)),'[]') from public.profiles where private.active_user() and active
$$;
create function public.app_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'settings',(select row_to_json(s) from public.settings s limit 1),
    'profiles',coalesce((select jsonb_agg(p) from public.profiles p),'[]'),
    'directory',private.directory(),
    'units',coalesce((select jsonb_agg(u) from public.units u),'[]'),
    'vehicles',coalesce((select jsonb_agg(v) from public.vehicles v),'[]'),
    'assignments',coalesce((select jsonb_agg(a) from public.assignments a),'[]'),
    'requests',coalesce((select jsonb_agg(r order by created_at desc) from public.requests r),'[]'),
    'candidates',coalesce((select jsonb_agg(c) from public.candidates c),'[]'),
    'reservations',coalesce((select jsonb_agg(r order by starts_at desc) from public.reservations r),'[]'),
    'changes',coalesce((select jsonb_agg(c) from public.changes c),'[]'),
    'series',coalesce((select jsonb_agg(s) from public.series s),'[]'),
    'blocks',coalesce((select jsonb_agg(b) from public.blocks b),'[]'),
    'fuels',coalesce((select jsonb_agg(f) from public.fuels f),'[]'),
    'incidents',coalesce((select jsonb_agg(i) from public.incidents i),'[]'),
    'notifications',coalesce((select jsonb_agg(n order by created_at desc) from public.notifications n),'[]'),
    'audit_log',coalesce((select jsonb_agg(a order by created_at desc) from public.audit_log a),'[]'),
    'calendar',private.calendar())
$$;

create function private.covers(v uuid, u uuid, s timestamptz, e timestamptz) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles where id=u and active) and (
    exists(select 1 from public.vehicles where id=v and manager_id=u and active) or
    exists(select 1 from public.assignments where vehicle_id=v and user_id=u and starts_at<=s and ends_at>=e))
$$;
create function private.generate_series_trips(sid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare rule public.series; dt date; until_date date; tz text; s timestamptz; e timestamptz; skipped jsonb:='[]'; added integer:=0; tid uuid;
begin
  select * into rule from public.series where id=sid and active;
  if not found then return jsonb_build_object('created',0,'skipped',skipped); end if;
  select timezone, (now() at time zone timezone)::date+recurrence_horizon into tz,until_date from public.settings;
  until_date:=least(until_date,coalesce(rule.end_date,until_date));
  for dt in select d::date from generate_series(greatest(rule.start_date,(now() at time zone tz)::date)::timestamp,until_date::timestamp,'1 day') d loop
    if not ((rule.frequency='daily')
      or (rule.frequency='weekly' and extract(dow from dt)::integer=any(rule.weekdays))
      or (rule.frequency='fortnightly' and (dt-rule.start_date)%15=0)
      or (rule.frequency='monthly' and extract(day from dt)=extract(day from rule.start_date))) then continue; end if;
    if exists(select 1 from public.reservations where series_id=sid and occurrence_date=dt) then continue; end if;
    s:=(dt+rule.start_time) at time zone tz;
    e:=(dt+rule.day_span+rule.end_time) at time zone tz;
    if s<=now() then continue; end if;
    if not private.covers(rule.vehicle_id,rule.driver_id,s,e) then continue; end if;
    begin
      perform private.assert_available(rule.vehicle_id,rule.driver_id,s,e);
      insert into public.reservations(series_id,occurrence_date,vehicle_id,driver_id,destination,starts_at,ends_at)
      values(sid,dt,rule.vehicle_id,rule.driver_id,rule.destination,s,e) returning id into tid;
      added:=added+1;
    exception when raise_exception or exclusion_violation then
      skipped:=skipped||jsonb_build_array(jsonb_build_object('date',dt,'reason',sqlerrm));
      perform private.notify(rule.driver_id,'Data não criada na recorrência',to_char(dt,'DD/MM/YYYY')||': '||sqlerrm,sid,'series','series-skip:'||sid||':'||dt);
    end;
  end loop;
  update public.series set generated_until=until_date where id=sid;
  -- Repetir a rotina nunca duplica reservas. Conflitos podem ser tentados novamente.
  perform private.close_conflicts(r.vehicle_id,r.starts_at,r.ends_at) from public.reservations r where r.series_id=sid and r.status='approved';
  return jsonb_build_object('created',added,'skipped',skipped);
end $$;

create function private.require_asset(path text, trip uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  if path is null or split_part(path,'/',2)<>trip::text or not exists(select 1 from storage.objects where bucket_id='trip-files' and name=path) then
    raise exception 'Envie as fotos e os comprovantes antes de concluir.';
  end if;
end $$;

create function private.command(action text, p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid(); eid uuid; vid uuid; rid uuid; cid uuid;
  req public.requests; cand public.candidates; trip public.reservations; ch public.changes; inc public.incidents;
  s timestamptz; e timestamptz; actual timestamptz; dest text; note text; km numeric;
  x jsonb; path text; result jsonb:='{}'; before_row jsonb; row_data jsonb; r record;
begin
  if uid is null or not private.active_user() then raise exception 'Acesso não autorizado ou usuário inativo.'; end if;
  -- Uma única ordem de lock elimina deadlocks entre carro, motorista, bloqueios e séries.
  -- Exclusões GiST ainda impedem sobreposição mesmo fora desta API.
  perform pg_advisory_xact_lock(742019261);
  eid:=nullif(p->>'id','')::uuid;
  if action='save_profile' then
    if length(trim(coalesce(p->>'full_name','')))<3 or length(trim(coalesce(p->>'phone','')))<8 then raise exception 'Informe nome completo e WhatsApp.'; end if;
    update public.profiles set full_name=trim(p->>'full_name'),phone=trim(p->>'phone'),unit_id=(p->>'unit_id')::uuid where id=uid;
  elsif action='create_request' then
    s:=(p->>'starts_at')::timestamptz; e:=(p->>'ends_at')::timestamptz; dest:=trim(p->>'destination');
    if s<=now() or e<=s or s is null or e is null or coalesce(dest,'')='' then raise exception 'Informe destino e um período futuro válido.'; end if;
    if not exists(select 1 from public.profiles where id=uid and phone<>'' and unit_id is not null and length(trim(full_name))>=3) then raise exception 'Complete seu perfil antes de solicitar.'; end if;
    vid:=nullif(p->>'vehicle_id','')::uuid;
    insert into public.requests(driver_id,destination,starts_at,ends_at,mode) values(uid,dest,s,e,case when vid is null then 'any' else 'specific' end) returning id into eid;
    for r in select id from public.vehicles where active and (vid is null or id=vid) loop
      begin
        perform private.assert_available(r.id,uid,s,e);
        insert into public.candidates(request_id,vehicle_id) values(eid,r.id);
      exception when raise_exception then null; end;
    end loop;
    if not exists(select 1 from public.candidates where request_id=eid) then raise exception 'Nenhum carro disponível nesse período. Tente outro horário ou veículo.'; end if;
    if vid is null then select vehicle_id into vid from public.candidates where request_id=eid and private.manages(vehicle_id) order by vehicle_id limit 1; end if;
    if vid is not null and private.manages(vid) then
      result:=private.command('decide_request',jsonb_build_object('id',eid,'vehicle_id',vid,'approve',true));
    else
      for r in select vehicle_id from public.candidates where request_id=eid loop
        perform private.notify_managers(r.vehicle_id,'Nova solicitação',dest,eid,'request','new-request:'||eid);
      end loop;
    end if;
    result:=result||jsonb_build_object('id',eid);
  elsif action='cancel_request' then
    select * into req from public.requests where id=eid;
    if req.id is null or req.driver_id<>uid or req.status<>'pending' then raise exception 'Somente o motorista pode cancelar a própria solicitação pendente.'; end if;
    update public.requests set status='cancelled' where id=eid;
    update public.candidates set status='closed',decided_at=now() where request_id=eid and status='pending';
  elsif action='decide_request' then
    vid:=(p->>'vehicle_id')::uuid;
    if not private.manages(vid) then raise exception 'Somente um responsável ativo desse veículo pode decidir.'; end if;
    select * into req from public.requests where id=eid;
    select * into cand from public.candidates where request_id=eid and vehicle_id=vid;
    if req.id is null or req.status<>'pending' or cand.id is null or cand.status<>'pending' then raise exception 'Esta solicitação já foi decidida.'; end if;
    if req.starts_at<=now() then raise exception 'O horário de saída passou. A solicitação expirou.'; end if;
    if (p->>'approve')::boolean then
      perform private.assert_available(vid,req.driver_id,req.starts_at,req.ends_at);
      insert into public.reservations(request_id,driver_id,vehicle_id,destination,starts_at,ends_at)
      values(eid,req.driver_id,vid,req.destination,req.starts_at,req.ends_at) returning id into rid;
      update public.requests set status='approved' where id=eid;
      update public.candidates set status=case when vehicle_id=vid then 'approved' else 'closed' end,
        decided_by=case when vehicle_id=vid then uid else null end,decided_at=now() where request_id=eid and status='pending';
      perform private.close_conflicts(vid,req.starts_at,req.ends_at);
      perform private.notify(req.driver_id,'Reserva confirmada',req.destination,rid,'trip','approved:'||eid);
      result:=jsonb_build_object('reservation_id',rid);
    else
      update public.candidates set status='rejected',decided_by=uid,decided_at=now(),reason=p->>'reason' where id=cand.id;
      perform private.finish_unavailable();
    end if;
  elsif action in ('cancel_trip','checkout','checkin','correct_km','propose_change') then
    select * into trip from public.reservations where id=eid;
    if trip.id is null or not (trip.driver_id=uid or private.manages(trip.vehicle_id)) then raise exception 'Viagem não encontrada ou sem permissão.'; end if;
    before_row:=to_jsonb(trip); vid:=trip.vehicle_id;
    if action='cancel_trip' then
      if trip.status<>'approved' then raise exception 'Só é possível cancelar antes da retirada.'; end if;
      update public.reservations set status='cancelled' where id=eid;
      update public.changes set status='expired' where reservation_id=eid and status='pending';
      if trip.request_id is not null then update public.requests set status='cancelled' where id=trip.request_id; end if;
      perform private.notify(trip.driver_id,'Reserva cancelada',trip.destination,eid,'trip','cancelled:'||eid);
      perform private.notify_managers(vid,'Reserva cancelada',trip.destination,eid,'trip','cancelled:'||eid);
    elsif action='propose_change' then
      if trip.driver_id<>uid then raise exception 'Somente o motorista propõe uma alteração.'; end if;
      if trip.status not in ('approved','in_progress') then raise exception 'Esta viagem não aceita alterações.'; end if;
      s:=(p->>'starts_at')::timestamptz; e:=(p->>'ends_at')::timestamptz; dest:=trim(p->>'destination');
      if s is null or e is null or e<=s or coalesce(dest,'')='' then raise exception 'Informe um período e destino válidos.'; end if;
      if trip.status='in_progress' and (s<>trip.starts_at or dest<>trip.destination or e<=trip.ends_at or e<=now()) then raise exception 'Durante a viagem, apenas prorrogue o retorno.'; end if;
      if trip.status='approved' and s<=now() then raise exception 'A nova saída deve estar no futuro.'; end if;
      insert into public.changes(reservation_id,destination,starts_at,ends_at,kind,created_by)
      values(eid,dest,s,e,case when trip.status='in_progress' then 'extension' else 'change' end,uid) returning id into cid;
      perform private.notify_managers(vid,'Alteração aguardando decisão',trip.destination,eid,'trip','new-change:'||cid);
    elsif action in ('checkout','checkin') then
      km:=(p->>'km')::numeric; note:=trim(coalesce(p->>'justification',''));
      actual:=case when trip.driver_id=uid then now() else (p->>'actual_at')::timestamptz end;
      if actual is null or actual>now()+interval '1 minute' or km is null or km<0 then raise exception 'Informe horário real e quilometragem válidos.'; end if;
      if trip.driver_id<>uid and note='' then raise exception 'Justifique o registro em nome do motorista.'; end if;
      if action='checkout' then
        if trip.status<>'approved' then raise exception 'A viagem já foi retirada ou encerrada.'; end if;
        if actual>=trip.ends_at then raise exception 'O retorno previsto já passou. Solicite alteração antes da retirada.'; end if;
        if exists(select 1 from public.reservations where id<>eid and status='in_progress' and (vehicle_id=vid or driver_id=trip.driver_id)) then raise exception 'O carro ou o motorista ainda tem uma viagem em andamento.'; end if;
        perform private.assert_available(vid,trip.driver_id,least(actual,trip.starts_at),trip.ends_at,eid);
        update public.reservations set status='in_progress',actual_start=actual,km_out=km,departure_by=uid,departure_note=note where id=eid;
        perform private.close_conflicts(vid,least(actual,trip.starts_at),trip.ends_at);
      else
        if trip.status<>'in_progress' then raise exception 'Registre a retirada antes de devolver.'; end if;
        if km<trip.km_out or actual<trip.actual_start then raise exception 'A devolução não pode ter km ou horário anterior à retirada.'; end if;
        if p->'no_incidents' is null or jsonb_typeof(p->'no_incidents')<>'boolean' then raise exception 'Declare se houve problemas ou acidentes.'; end if;
        if not (p->>'no_incidents')::boolean and jsonb_array_length(coalesce(p->'incidents','[]'))=0 then raise exception 'Registre a ocorrência com fotos ou declare que não houve problemas.'; end if;
        if (p->>'no_incidents')::boolean and jsonb_array_length(coalesce(p->'incidents','[]'))>0 then raise exception 'A declaração e as ocorrências são incompatíveis.'; end if;
        for x in select * from jsonb_array_elements(coalesce(p->'fuels','[]')) loop
          perform private.require_asset(x->>'receipt_path',eid);
          insert into public.fuels(reservation_id,amount,receipt_path) values(eid,(x->>'amount')::numeric,x->>'receipt_path');
        end loop;
        for x in select * from jsonb_array_elements(coalesce(p->'incidents','[]')) loop
          if (x->>'occurred_at')::timestamptz>actual or (x->>'occurred_at')::timestamptz<date_trunc('minute',trip.actual_start) then raise exception 'A ocorrência deve ter acontecido durante a viagem.'; end if;
          for path in select jsonb_array_elements_text(x->'photos') loop perform private.require_asset(path,eid); end loop;
          insert into public.incidents(reservation_id,kind,description,occurred_at,location,photos)
          values(eid,x->>'kind',trim(x->>'description'),(x->>'occurred_at')::timestamptz,trim(x->>'location'),array(select jsonb_array_elements_text(x->'photos'))) returning id into cid;
          perform private.notify_managers(vid,'Ocorrência registrada',x->>'description',cid,'incident','incident:'||cid);
        end loop;
        update public.reservations set status='completed',actual_end=actual,km_in=km,return_by=uid,return_note=note,no_incidents=(p->>'no_incidents')::boolean where id=eid;
        update public.changes set status='expired' where reservation_id=eid and status='pending';
      end if;
    else
      if not private.manages(vid) then raise exception 'Só o responsável pode corrigir quilometragens.'; end if;
      if length(trim(coalesce(p->>'justification','')))=0 then raise exception 'Informe a justificativa da correção.'; end if;
      if trip.actual_start is null then raise exception 'Não há quilometragem de retirada para corrigir.'; end if;
      if (p->>'km_out')::numeric<0 or (p->>'km_out') is null then raise exception 'Informe uma quilometragem válida.'; end if;
      if trip.actual_end is not null and (p->>'km_in') is null then raise exception 'Informe a quilometragem de devolução.'; end if;
      update public.reservations set km_out=(p->>'km_out')::numeric,km_in=case when actual_end is not null then (p->>'km_in')::numeric else null end where id=eid;
    end if;
  elsif action='decide_change' then
    select * into ch from public.changes where id=eid;
    select * into trip from public.reservations where id=ch.reservation_id;
    if ch.id is null or not private.manages(trip.vehicle_id) then raise exception 'Sem permissão para decidir esta alteração.'; end if;
    if ch.status<>'pending' or trip.status not in ('approved','in_progress') then raise exception 'Esta alteração já foi decidida ou encerrada.'; end if;
    before_row:=to_jsonb(trip);
    if (p->>'approve')::boolean then
      if (trip.status='approved' and ch.starts_at<=now()) or ch.ends_at<=now() then raise exception 'O horário proposto já passou.'; end if;
      perform private.assert_available(trip.vehicle_id,trip.driver_id,least(ch.starts_at,coalesce(trip.actual_start,ch.starts_at)),ch.ends_at,trip.id);
      update public.reservations set starts_at=ch.starts_at,ends_at=ch.ends_at,destination=ch.destination where id=trip.id;
      update public.changes set status='approved',decided_by=uid where id=eid;
      perform private.close_conflicts(trip.vehicle_id,ch.starts_at,ch.ends_at);
    else update public.changes set status='rejected',decided_by=uid where id=eid; end if;
    perform private.notify(trip.driver_id,case when (p->>'approve')::boolean then 'Alteração aprovada' else 'Alteração recusada' end,'Consulte os horários da sua reserva.',trip.id,'trip','change-decided:'||eid);
  elsif action='create_block' then
    vid:=(p->>'vehicle_id')::uuid;
    if not private.manages(vid) then raise exception 'Somente o responsável pode bloquear este veículo.'; end if;
    s:=coalesce((p->>'starts_at')::timestamptz,now()); e:=nullif(p->>'ends_at','')::timestamptz;
    if length(trim(coalesce(p->>'reason','')))=0 then raise exception 'Informe o motivo da manutenção.'; end if;
    insert into public.blocks(vehicle_id,starts_at,ends_at,reason,created_by) values(vid,s,e,trim(p->>'reason'),uid) returning id into eid;
    for r in select * from public.reservations where vehicle_id=vid and status='approved' and tstzrange(starts_at,ends_at,'[)') && tstzrange(s,e,'[)') loop
      update public.reservations set status='cancelled' where id=r.id;
      update public.changes set status='expired' where reservation_id=r.id and status='pending';
      update public.requests set status='cancelled' where id=r.request_id;
      perform private.notify(r.driver_id,'Reserva cancelada por manutenção',p->>'reason',r.id,'trip','maintenance-cancel:'||r.id||':'||eid);
    end loop;
    update public.candidates c set status='unavailable',decided_at=now() from public.requests q where c.request_id=q.id and c.vehicle_id=vid and c.status='pending' and q.status='pending' and tstzrange(q.starts_at,q.ends_at,'[)') && tstzrange(s,e,'[)');
    perform private.finish_unavailable();
  elsif action='release_block' then
    select vehicle_id into vid from public.blocks where id=eid and released_at is null;
    if vid is null or not private.manages(vid) then raise exception 'Bloqueio não encontrado ou sem permissão.'; end if;
    update public.blocks set released_at=now() where id=eid;
  elsif action='save_assignment' then
    vid:=(p->>'vehicle_id')::uuid;
    if not exists(select 1 from public.vehicles where id=vid and manager_id=uid) then raise exception 'Apenas o responsável principal indica temporários.'; end if;
    if eid is not null then delete from public.assignments where id=eid and vehicle_id=vid;
    else
      if not exists(select 1 from public.profiles where id=(p->>'user_id')::uuid and active) then raise exception 'Escolha uma pessoa com cadastro ativo.'; end if;
      insert into public.assignments(vehicle_id,user_id,starts_at,ends_at,created_by) values(vid,(p->>'user_id')::uuid,(p->>'starts_at')::timestamptz,(p->>'ends_at')::timestamptz,uid) returning id into eid;
    end if;
  elsif action='update_incident' then
    select * into inc from public.incidents where id=eid;
    select vehicle_id into vid from public.reservations where id=inc.reservation_id;
    if vid is null or not private.manages(vid) then raise exception 'Somente o responsável pode tratar esta ocorrência.'; end if;
    before_row:=to_jsonb(inc);
    update public.incidents set status=p->>'status',measures=coalesce(p->>'measures',''),updated_by=uid where id=eid;
  elsif action in ('create_series','edit_series','stop_series') then
    if action='create_series' then
      vid:=(p->>'vehicle_id')::uuid;
      if not private.manages(vid) then raise exception 'Somente o responsável ativo pode criar recorrências.'; end if;
      if trim(coalesce(p->>'destination',''))='' then raise exception 'Informe o destino.'; end if;
      if p->>'frequency'='weekly' and jsonb_array_length(coalesce(p->'weekdays','[]'))=0 then raise exception 'Escolha os dias da semana.'; end if;
      insert into public.series(vehicle_id,driver_id,destination,start_date,end_date,start_time,end_time,day_span,frequency,weekdays)
      values(vid,uid,trim(p->>'destination'),(p->>'start_date')::date,nullif(p->>'end_date','')::date,(p->>'start_time')::time,(p->>'end_time')::time,coalesce((p->>'day_span')::int,0),p->>'frequency',array(select jsonb_array_elements_text(coalesce(p->'weekdays','[]'))::integer)) returning id into eid;
      result:=private.generate_series_trips(eid);
    else
      select vehicle_id into vid from public.series where id=eid;
      if vid is null or not private.manages(vid) then raise exception 'Sem permissão para alterar esta recorrência.'; end if;
      if action='stop_series' then
        update public.series set active=false where id=eid;
        for r in select * from public.reservations where series_id=eid and status='approved' and starts_at>now() loop
          update public.reservations set status='cancelled' where id=r.id;
          update public.changes set status='expired' where reservation_id=r.id and status='pending';
          perform private.notify(r.driver_id,'Recorrência encerrada',r.destination,r.id,'trip','series-stop:'||r.id);
        end loop;
      else
        if not exists(select 1 from public.series where id=eid and driver_id=uid) then raise exception 'Somente o motorista da série pode alterar seu destino e horários.'; end if;
        if trim(coalesce(p->>'destination',''))='' then raise exception 'Informe o destino.'; end if;
        -- Horários novos são aplicados ocorrência a ocorrência. Falhas preservam a reserva válida.
        result:=jsonb_build_object('updated',0,'skipped','[]'::jsonb);
        for r in select * from public.reservations where series_id=eid and status='approved' and starts_at>now() order by starts_at loop
          begin
            select (r.occurrence_date+(p->>'start_time')::time) at time zone timezone,
              (r.occurrence_date+coalesce((p->>'day_span')::int,0)+(p->>'end_time')::time) at time zone timezone into s,e from public.settings;
            if s<=now() or not private.covers(vid,r.driver_id,s,e) then raise exception 'Fora da vigência ou horário passado.'; end if;
            perform private.assert_available(vid,r.driver_id,s,e,r.id);
            update public.reservations set starts_at=s,ends_at=e,destination=trim(p->>'destination') where id=r.id;
            update public.changes set status='expired' where reservation_id=r.id and status='pending';
            result:=jsonb_set(result,'{updated}',to_jsonb((result->>'updated')::int+1));
          exception when raise_exception or exclusion_violation then
            result:=jsonb_set(result,'{skipped}',(result->'skipped')||jsonb_build_array(jsonb_build_object('date',r.occurrence_date,'reason',sqlerrm)));
          end;
        end loop;
        update public.series set destination=trim(p->>'destination'),start_time=(p->>'start_time')::time,end_time=(p->>'end_time')::time,day_span=coalesce((p->>'day_span')::int,0) where id=eid;
        perform private.close_conflicts(r2.vehicle_id,r2.starts_at,r2.ends_at) from public.reservations r2 where r2.series_id=eid and r2.status='approved';
      end if;
    end if;
  elsif action='mark_read' then
    update public.notifications set read_at=coalesce(read_at,now()) where user_id=uid and (eid is null or id=eid);
  elsif action='subscribe_push' then
    if coalesce(p->'subscription'->>'endpoint','') !~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com|web\.push\.apple\.com|[a-z0-9.-]+\.push\.apple\.com)/' or p->'subscription'->'keys'->>'p256dh' is null or p->'subscription'->'keys'->>'auth' is null then raise exception 'Assinatura de notificações inválida ou provedor não compatível.'; end if;
    insert into public.push_subscriptions(user_id,endpoint,subscription) values(uid,p->'subscription'->>'endpoint',p->'subscription')
    on conflict(endpoint) do update set user_id=uid,subscription=excluded.subscription;
  elsif action='unsubscribe_push' then
    delete from public.push_subscriptions where user_id=uid and endpoint=p->>'endpoint';
  elsif action in ('save_unit','save_vehicle','save_user','save_settings') then
    if not private.is_admin() then raise exception 'Somente o administrador gerencia cadastros.'; end if;
    if action='save_unit' then
      if eid is null then insert into public.units(name,kind) values(trim(p->>'name'),p->>'kind') returning id into eid;
      else update public.units set name=trim(p->>'name'),kind=p->>'kind',active=coalesce((p->>'active')::boolean,true) where id=eid; end if;
    elsif action='save_vehicle' then
      if trim(coalesce(p->>'name',''))='' or trim(coalesce(p->>'model',''))='' or trim(coalesce(p->>'plate',''))='' then raise exception 'Preencha nome, modelo e placa.'; end if;
      if not exists(select 1 from public.profiles where id=(p->>'manager_id')::uuid and active) then raise exception 'Escolha um responsável principal ativo.'; end if;
      if p->>'photo_path' is null or not exists(select 1 from storage.objects where bucket_id='vehicle-photos' and name=p->>'photo_path') then raise exception 'Envie a foto do carro antes de salvar.'; end if;
      if eid is null then
        insert into public.vehicles(name,model,plate,unit_id,manager_id,photo_path,color)
        values(trim(p->>'name'),trim(p->>'model'),upper(trim(p->>'plate')),(p->>'unit_id')::uuid,(p->>'manager_id')::uuid,p->>'photo_path',coalesce(p->>'color','#912c3a')) returning id into eid;
      else
        update public.vehicles set name=trim(p->>'name'),model=trim(p->>'model'),plate=upper(trim(p->>'plate')),unit_id=(p->>'unit_id')::uuid,
          manager_id=(p->>'manager_id')::uuid,photo_path=p->>'photo_path',color=coalesce(p->>'color',color),active=coalesce((p->>'active')::boolean,true) where id=eid;
      end if;
    elsif action='save_user' then
      if length(trim(coalesce(p->>'full_name','')))<3 then raise exception 'Informe o nome completo do usuário.'; end if;
      select to_jsonb(q) into before_row from public.profiles q where id=eid;
      if eid=uid and (not (p->>'is_admin')::boolean or not (p->>'active')::boolean) then raise exception 'Você não pode remover seu próprio acesso administrativo.'; end if;
      update public.profiles set full_name=trim(p->>'full_name'),phone=coalesce(p->>'phone',''),unit_id=nullif(p->>'unit_id','')::uuid,
        is_admin=(p->>'is_admin')::boolean,active=(p->>'active')::boolean where id=eid;
    else
      if not exists(select 1 from pg_timezone_names where name=p->>'timezone') then raise exception 'Fuso horário inválido.'; end if;
      update public.settings set timezone=p->>'timezone';
    end if;
  else raise exception 'Ação desconhecida.';
  end if;
  if action not in ('mark_read','subscribe_push','unsubscribe_push') then
    insert into public.audit_log(actor_id,action,entity_id,before_data,after_data) values(uid,action,eid,before_row,p);
  end if;
  return result||jsonb_build_object('id',eid);
end $$;

create function public.app_command(action text, payload jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$ select private.command(action,payload) $$;

create function private.maintenance() returns jsonb language plpgsql security definer set search_path='' as $$
declare r record; n record; sid uuid; expired_count integer:=0; begin
  perform pg_advisory_xact_lock(742019261);
  for r in select * from public.requests where status='pending' and starts_at<=now() loop
    update public.requests set status='expired' where id=r.id;
    update public.candidates set status='closed',decided_at=now() where request_id=r.id and status='pending';
    perform private.notify(r.driver_id,'Solicitação expirada','O horário previsto passou sem uma decisão.',r.id,'request','expired:'||r.id);
    expired_count:=expired_count+1;
  end loop;
  update public.changes c set status='expired' from public.reservations t where t.id=c.reservation_id and c.status='pending' and
    (t.status not in ('approved','in_progress') or (t.status='approved' and c.starts_at<=now()) or c.ends_at<=now());
  for r in select * from public.reservations where status in ('approved','in_progress') loop
    if r.status='approved' and r.starts_at>now() and r.starts_at<=now()+interval '10 minutes' then
      perform private.notify(r.driver_id,'Sua retirada é em até 10 minutos',r.destination,r.id,'trip','departure:'||r.id||':'||r.starts_at);
    end if;
    if r.ends_at>now() and r.ends_at<=now()+interval '10 minutes' then
      perform private.notify(r.driver_id,'Sua devolução é em até 10 minutos',r.destination,r.id,'trip','return:'||r.id||':'||r.ends_at);
    end if;
    if r.status='in_progress' and r.ends_at<=now() then
      perform private.notify_managers(r.vehicle_id,'Devolução atrasada',r.destination,r.id,'trip','late:'||r.id||':'||r.ends_at);
      for n in select * from public.reservations where vehicle_id=r.vehicle_id and status='approved' and starts_at>=r.ends_at and ends_at>now() order by starts_at limit 1 loop
        perform private.notify(n.driver_id,'O carro da sua próxima viagem está atrasado','A viagem anterior ainda não registrou a devolução.',n.id,'trip','late:'||r.id||':'||r.ends_at);
      end loop;
    end if;
  end loop;
  for sid in select rules.id from public.series rules cross join public.settings cfg where rules.active and
    (rules.generated_until is null or rules.generated_until<least(coalesce(rules.end_date,'infinity'::date),(now() at time zone cfg.timezone)::date+cfg.recurrence_horizon))
  loop perform private.generate_series_trips(sid); end loop;
  return jsonb_build_object('expired',expired_count);
end $$;
create function public.run_maintenance() returns jsonb language sql security invoker set search_path='' as $$ select private.maintenance() $$;

-- Outbox com concessão temporária: duas execuções não enviam o mesmo lote.
create function private.claim_push() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; begin
  with claimed as (
    update public.notifications set push_claimed_at=now()
    where id in (select id from public.notifications where push_sent_at is null and
      (push_claimed_at is null or push_claimed_at<now()-interval '5 minutes') and created_at>now()-interval '24 hours'
      order by created_at for update skip locked limit 20)
    returning *
  ) select coalesce(jsonb_agg(jsonb_build_object('notification',c,'subscriptions',
    coalesce((select jsonb_agg(s) from public.push_subscriptions s where s.user_id=c.user_id and
      not exists(select 1 from public.push_deliveries d where d.notification_id=c.id and d.subscription_id=s.id)),'[]'))),'[]') into result from claimed c;
  return result;
end $$;
create function public.claim_push() returns jsonb language sql security invoker set search_path='' as $$ select private.claim_push() $$;

-- Arquivos privados, com vínculo à viagem e autorização do próprio banco.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('trip-files','trip-files',false,10485760,array['image/jpeg','image/png','image/webp']),
 ('vehicle-photos','vehicle-photos',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
create function private.file_access(path text, writing boolean) returns boolean language plpgsql stable security definer set search_path='' as $$
declare tid uuid; begin
  if not private.active_user() then return false; end if;
  if split_part(path,'/',2) !~ '^[0-9a-fA-F-]{36}$' then return false; end if;
  begin tid:=split_part(path,'/',2)::uuid; exception when invalid_text_representation then return false; end;
  if writing then
    return split_part(path,'/',1)=auth.uid()::text and exists(select 1 from public.reservations where id=tid and status='in_progress' and (driver_id=auth.uid() or private.manages(vehicle_id)));
  end if;
  return private.trip_access(tid);
end $$;
create policy trip_files_read on storage.objects for select to authenticated using(bucket_id='trip-files' and private.file_access(name,false));
create policy trip_files_insert on storage.objects for insert to authenticated with check(bucket_id='trip-files' and private.file_access(name,true));
create policy vehicle_photos_read on storage.objects for select to authenticated using(bucket_id='vehicle-photos' and private.active_user());
create policy vehicle_photos_insert on storage.objects for insert to authenticated with check(bucket_id='vehicle-photos' and private.is_admin() and split_part(name,'/',1)=auth.uid()::text);

revoke execute on all functions in schema private from public,anon,authenticated;
revoke execute on function public.app_command(text,jsonb),public.app_snapshot(),public.run_maintenance(),public.claim_push() from public,anon,authenticated;
grant execute on function private.active_user(),private.is_admin(),private.manages(uuid,uuid),private.trip_access(uuid),private.request_access(uuid),private.profile_access(uuid),private.calendar(),private.directory(),private.file_access(text,boolean),private.command(text,jsonb) to authenticated;
grant execute on function public.app_snapshot(),public.app_command(text,jsonb) to authenticated;
grant execute on function private.maintenance(),private.claim_push(),public.run_maintenance(),public.claim_push() to service_role;
