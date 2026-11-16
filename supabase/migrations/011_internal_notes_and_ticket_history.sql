-- Technician-only notes and a structured audit timeline for ticket changes.

create table if not exists public.ticket_internal_notes (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  author_technician_id uuid not null references public.technicians(id),
  note text not null check (length(trim(note)) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index if not exists ticket_internal_notes_ticket_created_idx
  on public.ticket_internal_notes (ticket_id, created_at desc);

alter table public.ticket_internal_notes enable row level security;
grant select, insert on public.ticket_internal_notes to service_role;

create table if not exists public.ticket_history (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  source_activity_id uuid unique references public.ticket_activity(id) on delete set null,
  actor_type text not null check (actor_type in ('requester', 'technician', 'system')),
  actor_technician_id uuid references public.technicians(id),
  event_type text not null check (event_type in ('created', 'field_changed', 'status_changed', 'assigned', 'escalated', 'note')),
  summary text not null check (length(trim(summary)) between 1 and 500),
  field_name text,
  old_value text,
  new_value text,
  created_at timestamptz not null default now(),
  constraint ticket_history_technician_actor_check
    check ((actor_type = 'technician') = (actor_technician_id is not null))
);

create index if not exists ticket_history_ticket_created_idx
  on public.ticket_history (ticket_id, created_at desc);

alter table public.ticket_history enable row level security;
grant select, insert on public.ticket_history to service_role;

-- Preserve existing activity as history before the API switches to the new table.
insert into public.ticket_history (
  ticket_id, source_activity_id, actor_type, actor_technician_id, event_type, summary, created_at
)
select
  old_activity.ticket_id,
  old_activity.id,
  old_activity.actor_type,
  old_activity.actor_technician_id,
  case old_activity.activity_type
    when 'created' then 'created'
    when 'status_changed' then 'status_changed'
    when 'assigned' then 'assigned'
    when 'escalated' then 'escalated'
    else 'note'
  end,
  old_activity.note,
  old_activity.created_at
from public.ticket_activity old_activity
on conflict (source_activity_id) do nothing;







