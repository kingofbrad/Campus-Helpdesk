-- Add the directory-management flag. Assign it to an authorized admin in each deployment.
alter table public.technicians
  add column if not exists can_manage_directory boolean not null default false;

