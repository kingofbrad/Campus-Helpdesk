-- Allow selected technician accounts to view tickets across all sites.
-- The default keeps existing student technicians restricted to their assignments.

alter table public.technicians
  add column if not exists can_view_all_tickets boolean not null default false;

