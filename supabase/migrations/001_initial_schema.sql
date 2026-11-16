-- Campus Support Desk demo schema.
-- Run this in Supabase SQL Editor. These tables intentionally have RLS enabled
-- and no client access policies yet; connect the server API before exposing data.

create extension if not exists pgcrypto;

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.technicians (
  id uuid primary key default gen_random_uuid(),
  entra_tenant_id text not null,
  entra_object_id text not null,
  display_name text not null,
  site_id uuid not null references public.sites(id),
  is_active boolean not null default true,
  can_view_all_tickets boolean not null default false,
  created_at timestamptz not null default now(),
  constraint technicians_entra_identity_unique unique (entra_tenant_id, entra_object_id),
  constraint technicians_id_site_unique unique (id, site_id)
);

create table public.ticket_daily_sequences (
  ticket_date date primary key,
  last_number bigint not null check (last_number > 0)
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number bigint generated always as identity unique,
  ticket_reference text not null unique,
  requester_name text not null,
  requester_email text not null,
  requester_tenant_id text,
  requester_object_id text,
  site_id uuid not null references public.sites(id),
  title text not null,
  description text not null,
  category text not null,
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high')),
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'waiting_for_student', 'resolved', 'escalated')),
  assigned_technician_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tickets_assignee_same_site_fk
    foreign key (assigned_technician_id, site_id)
    references public.technicians (id, site_id),
  constraint tickets_requester_identity_pair_check
    check ((requester_tenant_id is null) = (requester_object_id is null))
);

create table public.ticket_activity (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  actor_type text not null check (actor_type in ('requester', 'technician', 'system')),
  actor_technician_id uuid references public.technicians(id),
  activity_type text not null
    check (activity_type in ('created', 'note', 'status_changed', 'assigned', 'escalated')),
  note text not null,
  created_at timestamptz not null default now()
);

create table public.ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  author_type text not null check (author_type in ('requester', 'technician')),
  author_technician_id uuid references public.technicians(id),
  message text not null check (length(trim(message)) between 1 and 5000),
  created_at timestamptz not null default now(),
  constraint ticket_comments_technician_author_check
    check ((author_type = 'technician') = (author_technician_id is not null))
);

create index tickets_site_status_idx on public.tickets (site_id, status, created_at desc);
create index tickets_assignee_status_idx on public.tickets (assigned_technician_id, status, created_at desc);
create index tickets_requester_identity_idx on public.tickets (requester_tenant_id, requester_object_id, created_at desc);
create index ticket_activity_ticket_created_idx on public.ticket_activity (ticket_id, created_at);
create index ticket_comments_ticket_created_idx on public.ticket_comments (ticket_id, created_at);

create function public.set_ticket_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function public.assign_ticket_reference()
returns trigger
language plpgsql
as $$
declare
  ticket_day date;
  daily_number bigint;
begin
  ticket_day := (coalesce(new.created_at, now()) at time zone 'Europe/London')::date;
  insert into public.ticket_daily_sequences as current_sequence (ticket_date, last_number)
  values (ticket_day, 1)
  on conflict (ticket_date) do update
    set last_number = current_sequence.last_number + 1
  returning last_number into daily_number;
  new.ticket_reference := to_char(ticket_day, 'YY-MM-DD') || '-' || lpad(daily_number::text, 4, '0');
  return new;
end;
$$;

create trigger tickets_assign_reference
before insert on public.tickets
for each row execute function public.assign_ticket_reference();

create trigger tickets_set_updated_at
before update on public.tickets
for each row execute function public.set_ticket_updated_at();

alter table public.sites enable row level security;
alter table public.technicians enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_activity enable row level security;
alter table public.ticket_comments enable row level security;
alter table public.ticket_daily_sequences enable row level security;

insert into public.sites (code, name)
values ('north_campus', 'North Campus'), ('riverside_campus', 'Riverside Campus')
on conflict (code) do update set name = excluded.name;

