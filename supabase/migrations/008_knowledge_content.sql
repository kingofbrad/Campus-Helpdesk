create table if not exists public.knowledge_guides (
  id text primary key,
  title text not null check (char_length(title) between 1 and 140),
  category text not null check (char_length(category) between 1 and 80),
  summary text not null check (char_length(summary) between 1 and 500),
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  icon_key text not null default 'help',
  sort_order integer not null default 0,
  is_published boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.knowledge_guides (id, title, category, summary, steps, icon_key, sort_order)
values
  ('wifi', 'Connect to eduroam Wi-Fi', 'Wi-Fi & network', 'Check your username format, forget and rejoin the network, and verify device date and time.', '["Confirm the full campus username format.", "Forget eduroam, then reconnect using approved sign-in details.", "Check that date and time settings are automatic.", "If it continues, record the device type and exact error before escalating."]'::jsonb, 'wifi', 1),
  ('device', 'Laptop is slow or unresponsive', 'Device support', 'Safe first checks for slow startup, frozen apps, or performance problems.', '["Ask when the issue started and whether it affects one app or everything.", "Check power, available storage, and restart or update prompts.", "Restart once if the student has saved their work.", "Do not uninstall security tools or change administrator settings."]'::jsonb, 'laptop', 2),
  ('account', 'Troubleshoot account access', 'Accounts & access', 'Gather useful details without asking students for passwords or MFA codes.', '["Confirm which service and account are affected.", "Check whether they can sign in to another campus service.", "For course access, note the module code and enrolment context.", "Never ask for a password or MFA code."]'::jsonb, 'shield', 3),
  ('printing', 'Print credit and printer checks', 'Printing', 'Check balance refresh, printer selection, and job status before handover.', '["Confirm the student is signed into the correct print account.", "Refresh the balance or sign out and back in.", "Check printer selection and whether the job is held in the queue.", "Record printer location and any error message."]'::jsonb, 'printer', 4),
  ('room-equipment', 'Room equipment: no sound or display', 'Classroom equipment', 'Basic checks for cables, input selection, volume, and room setup.', '["Confirm the selected input matches the connected device.", "Check mute and volume on the device and room controls.", "Reconnect the cable and try the approved spare connection.", "If a teaching room is affected during a session, notify staff promptly."]'::jsonb, 'volume', 5),
  ('email-phone', 'Set up campus email on a phone', 'Accounts & access', 'Use the approved mail app and sign-in route for a new or reset phone.', '["Use the campus recommended mail app and automatic setup.", "Sign in on the student''s own device and complete MFA themselves.", "Do not handle or record passwords or MFA codes.", "If unexpected device management prompts appear, stop and escalate."]'::jsonb, 'help', 6)
on conflict (id) do nothing;

create table if not exists public.student_guidance (
  id boolean primary key default true check (id),
  title text not null default 'Student guidance',
  subtitle text not null default 'A few principles for supporting your fellow students.',
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  updated_at timestamptz not null default now()
);

insert into public.student_guidance (id, title, subtitle, items)
values (true, 'Student guidance', 'A few principles for supporting your fellow students.',
  '[{"heading":"1. Understand the issue","text":"Read the request carefully. Ask clear follow-up questions if anything is missing."},{"heading":"2. Use approved guidance","text":"Follow the knowledge base. Record what you tried and what happened."},{"heading":"3. Protect privacy","text":"Only access information needed to help. Never ask for passwords or share sensitive details."},{"heading":"4. Escalate when needed","text":"If an issue is outside your training, affects safety or security, or remains unresolved, hand it to staff."}]'::jsonb)
on conflict (id) do nothing;

alter table public.knowledge_guides enable row level security;
alter table public.student_guidance enable row level security;

-- Content is read and written through the helpdesk API using the server key.
-- No direct browser access policies are granted.
revoke all on public.knowledge_guides from anon, authenticated;
revoke all on public.student_guidance from anon, authenticated;
grant select, insert, update, delete on public.knowledge_guides to service_role;
grant select, insert, update, delete on public.student_guidance to service_role;

