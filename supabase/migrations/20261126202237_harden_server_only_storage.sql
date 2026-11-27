create schema if not exists extensions;
alter extension btree_gist set schema extensions;
grant usage on schema extensions to authenticated,service_role;

-- Esses registros pertencem somente ao processamento do servidor.
create policy server_manages_push_deliveries on public.push_deliveries
for all to service_role using(true) with check(true);
create policy server_manages_admin_onboarding on private.admin_onboarding
for all to service_role using(true) with check(true);
