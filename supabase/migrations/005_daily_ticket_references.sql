-- Add stable date-based ticket references with a counter that resets each day.
-- Dates use the Europe/London timezone.

create table if not exists public.ticket_daily_sequences (
  ticket_date date primary key,
  last_number bigint not null check (last_number > 0)
);

alter table public.tickets
  add column if not exists ticket_reference text;

with numbered_tickets as (
  select
    id,
    (created_at at time zone 'Europe/London')::date as ticket_day,
    row_number() over (
      partition by (created_at at time zone 'Europe/London')::date
      order by created_at, id
    ) as daily_number
  from public.tickets
  where ticket_reference is null
)
update public.tickets as ticket
set ticket_reference = to_char(numbered_tickets.ticket_day, 'YY-MM-DD')
  || '-' || lpad(numbered_tickets.daily_number::text, 4, '0')
from numbered_tickets
where ticket.id = numbered_tickets.id;

insert into public.ticket_daily_sequences as current_sequence (ticket_date, last_number)
select
  (created_at at time zone 'Europe/London')::date,
  count(*)::bigint
from public.tickets
group by (created_at at time zone 'Europe/London')::date
on conflict (ticket_date) do update
  set last_number = greatest(current_sequence.last_number, excluded.last_number);

alter table public.tickets
  alter column ticket_reference set not null;

create unique index if not exists tickets_ticket_reference_unique
  on public.tickets (ticket_reference);

create or replace function public.assign_ticket_reference()
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

drop trigger if exists tickets_assign_reference on public.tickets;
create trigger tickets_assign_reference
before insert on public.tickets
for each row execute function public.assign_ticket_reference();

alter table public.ticket_daily_sequences enable row level security;
grant select, insert, update on public.ticket_daily_sequences to service_role;

