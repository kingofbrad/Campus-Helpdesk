-- Restrict site and technician management to the primary all-sites admin.
alter table public.technicians
  add column if not exists can_manage_directory boolean not null default false;

-- Bootstrap the existing Bradlee King account that already has all-ticket access.
-- Other technicians retain no directory-management permission.
update public.technicians
set can_manage_directory = true
where can_view_all_tickets = true
  and lower(trim(display_name)) = 'bradlee king';

