-- Link self-service and Entra-selected walk-up tickets to the student's Microsoft identity.
-- Manually entered technician walk-up tickets keep these fields NULL.

alter table public.tickets
  add column if not exists requester_tenant_id text,
  add column if not exists requester_object_id text;

create index if not exists tickets_requester_identity_idx
  on public.tickets (requester_tenant_id, requester_object_id, created_at desc);

