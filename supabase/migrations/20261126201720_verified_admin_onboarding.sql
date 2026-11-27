-- Provisionamento explícito do administrador, somente após verificar o e-mail.
-- A lista é configurada por operação administrativa, nunca por metadados do usuário.
create table private.admin_onboarding (
  email text primary key check(email=lower(trim(email))),
  user_id uuid unique references auth.users(id),
  granted_at timestamptz
);
alter table private.admin_onboarding enable row level security;
revoke all on private.admin_onboarding from public, anon, authenticated;
grant all on private.admin_onboarding to service_role;

create function private.provision_verified_admin() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.email is null or new.email_confirmed_at is null then return new; end if;
  -- O bloqueio da linha impede duas identidades de consumirem a mesma indicação.
  update private.admin_onboarding set user_id=new.id,granted_at=now()
  where email=lower(trim(new.email)) and user_id is null;
  if found then
    update public.profiles set is_admin=true where id=new.id;
    insert into public.audit_log(action,entity_id,after_data)
    values('verified_admin_onboarding',new.id,jsonb_build_object('email',new.email));
  end if;
  return new;
end $$;
revoke all on function private.provision_verified_admin() from public,anon,authenticated;
create trigger provision_verified_admin after insert or update of email,email_confirmed_at on auth.users
for each row execute function private.provision_verified_admin();
