-- Grant only the server-side role required by the local demo API.
-- Do not grant these permissions to anon or authenticated browser roles.
grant usage on schema public to service_role;
grant select on public.sites, public.technicians to service_role;
grant select, insert, update on public.tickets to service_role;
grant select, insert on public.ticket_activity to service_role;
grant select, insert on public.ticket_comments to service_role;
grant select, insert, update on public.ticket_daily_sequences to service_role;
grant usage, select on sequence public.tickets_ticket_number_seq to service_role;

