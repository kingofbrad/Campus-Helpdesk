-- Shared requester/helpdesk comment thread for each ticket.

create table if not exists public.ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  author_type text not null check (author_type in ('requester', 'technician')),
  author_technician_id uuid references public.technicians(id),
  message text not null check (length(trim(message)) between 1 and 5000),
  created_at timestamptz not null default now(),
  constraint ticket_comments_technician_author_check
    check ((author_type = 'technician') = (author_technician_id is not null))
);

create index if not exists ticket_comments_ticket_created_idx
  on public.ticket_comments (ticket_id, created_at);

alter table public.ticket_comments enable row level security;
grant select, insert on public.ticket_comments to service_role;

