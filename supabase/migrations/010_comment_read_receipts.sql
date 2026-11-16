alter table public.ticket_comments
  add column if not exists read_at timestamptz;

create index if not exists ticket_comments_unread_by_ticket_idx
  on public.ticket_comments (ticket_id, author_type, read_at, created_at);

grant update on public.ticket_comments to service_role;