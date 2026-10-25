# Supabase setup

## Create the demo schema

1. Open the Campus Helpdesk project in the Supabase dashboard.
2. In the left menu, open **SQL Editor**.
3. Choose **New query**.
4. Open `supabase/migrations/001_initial_schema.sql` in this project and copy its contents into the query.
5. Select **Run**. The script creates the sites, technicians, ticket reference sequences, tickets, ticket activity, and ticket comments tables and inserts Sheppey and Canterbury as initial sites.
6. Choose **New query** again and run `supabase/migrations/002_server_api_grants.sql`. This gives only the server role the table permissions the local API needs; it does not open the tables to browser roles.
7. Open **Table Editor** and confirm the base tables exist. Open `sites` to confirm the two site rows were added.
8. For an existing project, open SQL Editor and run supabase/migrations/003_student_request_identity.sql. It adds the Entra identity columns used to show each student their own submitted tickets. For a brand-new database, the updated 001_initial_schema.sql already includes those columns; the extra migration is safe to run either way.
9. Run `supabase/migrations/004_ticket_comments.sql` to add the shared student and technician comment thread. A new database created from the current 001 schema already has the table; this migration is safe to run either way.
10. Run `supabase/migrations/005_daily_ticket_references.sql` to backfill existing tickets and enable references in `YY-MM-DD-NNNN` format, with a separate counter for each date. It is safe to run against a new database too.
11. Run `supabase/migrations/006_technician_team_visibility.sql` to add the optional all-sites ticket viewing permission. It is safe to run on a new database too.
12. Run `supabase/migrations/007_directory_admin.sql` to add the directory/content-management permission. It grants it to an existing all-sites technician named Bradlee King. If your admin technician has a different display name, grant `can_manage_directory` to that technician row using its Entra tenant ID and object ID.
13. Run `supabase/migrations/008_knowledge_content.sql` to create and seed the `knowledge_guides` and `student_guidance` tables used by the admin content editor.
14. Run `supabase/migrations/009_student_updated_status.sql` so the ticket status constraint accepts `student_updated`, which the app sets when a student replies. Run all migrations in order for new and existing databases.
15. Run `supabase/migrations/010_comment_read_receipts.sql` to add per-comment read timestamps. The API uses these to show unread reply counts in both ticket lists.
16. Run `supabase/migrations/011_internal_notes_and_ticket_history.sql` to create technician-only internal notes and structured ticket history. It backfills existing `ticket_activity` records into the history table.

The migration enables Row Level Security (RLS) on every table and intentionally adds no browser-access policies yet. That leaves the tables closed to the public Data API until the app's server API and access rules are configured. The site-matching foreign key also prevents assigning a ticket to a technician registered at another site.

## Connect the demo app

The React app uses a small local Node API. It validates Microsoft delegated access tokens and limits ticket listing and updates to the signed-in technician by default. The API response is the authoritative ticket list shown in the browser. A technician record can explicitly grant cross-site ticket viewing; that account can read ticket details and comments for all sites, but can only edit, change status, or reply to tickets assigned to it. A technician with `can_manage_directory` can manage sites, technician records, knowledge guides, and student guidance. Student technicians without these permissions receive only their assigned tickets and cannot edit shared helpdesk content. The API also accepts authenticated student requests without requiring a technician registration. It records each self-service ticket against the submitter's Entra tenant and object ID, then only returns tickets matching that identity to the student. The technician walk-up form also records the selected student's Entra identity when the technician chooses a directory result; manually entered walk-up tickets have no student identity link. Tickets are routed to the first active technician registered at the selected site, which may differ from the technician creating the walk-up ticket. The public site list contains only site names and codes. The Supabase secret key stays in the API process and is never sent to the browser. This is a prototype; have the organisation's system development/security teams review the design before any real student data or production use.

### 1. Create a separate API registration in Entra

The existing registration is the React SPA (the client). Register the API separately so Entra can list it under **My APIs**:

1. In **Entra ID > App registrations**, select **New registration**.
2. Name it `Campus Helpdesk API Demo`.
3. Select the same account audience as the SPA (any organizational directory and personal Microsoft accounts). Leave **Redirect URI** empty, then register it.
4. Copy this API registration's **Application (client) ID**. Keep it separate from the existing SPA client ID.
5. In the new API registration, open **Expose an API**. Set the Application ID URI to the suggested `api://<API-client-id>` if needed.
6. Select **Add a scope**. Use the name `access_as_user`, set **Who can consent** to **Admins only**, fill the admin display name and description, and leave the scope **Enabled**.
7. In this API registration's **Manifest**, set the top-level `requestedAccessTokenVersion` to `2` and save. Microsoft requires version 2 when personal Microsoft accounts are supported.

The scope you added to the SPA registration can remain there; it is unused. The API scope should now appear under **My APIs** when you add it to the SPA client.

### 2. Let the React SPA call the API

Open the **existing SPA app registration** (the one with the localhost redirect URI), then:

1. Go to **API permissions > Add a permission > My APIs**.
2. Select `Campus Helpdesk API Demo`.
3. Choose **Delegated permissions**, select `access_as_user`, and select **Add permissions**.
4. Select **Grant admin consent** for your tenant.

Keep its existing `User.Read` permission for displaying the signed-in user's name.

For technician directory search, also add **Microsoft Graph → Delegated permissions → `User.Read.All`** to the SPA registration and grant admin consent. This is needed to search users and read `companyName` for the site prefill. It is separate from the custom helpdesk API scope above, and is only used by the technician walk-up form. See [Entra sign-in and directory search](AUTHENTICATION.md#technician-student-directory-search) for the permission scope and demo security note.

### 3. Add local configuration

In `.env.local`, add the following values. Use the same app client ID and tenant ID already shown in Entra. Get the Supabase URL and a server-only **Secret key** from the project's API Keys settings. Keep every server value unprefixed by `VITE_` and never paste the secret key into chat or commit it.

```dotenv
VITE_ENTRA_API_SCOPE=api://<API-client-id>/access_as_user
ENTRA_API_CLIENT_ID=<API-client-id>
ENTRA_TENANT_ID=<tenant-id>
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SECRET_KEY=<Supabase-secret-key>
API_PORT=3001
```

Keep `VITE_ENTRA_CLIENT_ID` set to the original SPA registration. Use the separate API registration ID only in `VITE_ENTRA_API_SCOPE` and `ENTRA_API_CLIENT_ID`. Use the server-only `sb_secret_...` key, not the publishable key. Supabase secret keys bypass RLS, so only the API server should have one.

### 4. Register your technician account

Add your own test account to the `technicians` table. In Entra, open the user and copy its **Object ID**. Use your tenant ID, object ID, display name, and site code in this SQL, then run it in SQL Editor:

```sql
insert into public.technicians
  (entra_tenant_id, entra_object_id, display_name, site_id)
select
  '<tenant-id>', '<user-object-id>', '<display-name>', sites.id
from public.sites
where sites.code = 'sheppey'
on conflict (entra_tenant_id, entra_object_id)
do update set display_name = excluded.display_name,
              site_id = excluded.site_id,
              is_active = true;
```

Use `canterbury` for a Canterbury technician. The technician site is read from this row. For new student or walk-up tickets, the requester or technician selects a site and the API assigns the request to the first active technician registered at that site, ordered by registration time. A walk-up ticket is attributed to the selected student's Entra identity independently of its technician assignment. A production system may want load balancing or a shared site queue.

To let your main technician account view every site's tickets, first register it as a technician, then set the cross-site view permission using that account's Entra tenant ID and object ID:

```sql
update public.technicians
set can_view_all_tickets = true
where entra_tenant_id = '<tenant-id>'
  and entra_object_id = '<main-account-object-id>';
```

The permission is off by default for every account. The account can inspect unassigned ticket details and comments, while ticket editing, status changes, and replies remain limited to its own assignments. Keep this permission for trusted staff accounts only.

### 5. Start both local processes

Open two terminals in the project folder:

- Run `npm run dev` in one terminal for the React app.
- Run `npm run dev:api` in the other for the ticket API.

Restart both after changing `.env.local`. Sign in again when prompted to grant the new API scope. If the account has no technician row yet, the queue shows an explanatory message. The app uses sample in-memory tickets when `VITE_ENTRA_API_SCOPE` is not set.

## What the tables store

- `sites`: locations used by the submission form and routing rules.
- `technicians`: each technician's Entra tenant ID and object ID, display name, site, and optional cross-site ticket viewing permission.
- `ticket_daily_sequences`: one daily counter for generating user-facing ticket references.
- `tickets`: requester details, optional Entra tenant and object ID, selected site, issue, status, priority, and assigned technician. Self-service tickets and Entra-selected walk-up tickets have a requester identity; manually entered walk-up tickets do not.
- `ticket_activity`: legacy activity records, copied into `ticket_history` by migration 011.
- `ticket_history`: ticket creation, field edits, status changes, assignment, student replies, and note-added events, with actor and old/new values where applicable.
- `ticket_internal_notes`: private technician notes, stored separately from student-visible comments.
- `ticket_comments`: shared student and technician conversation messages, including a read timestamp for the other side. It does not support private notes.
- `knowledge_guides`: published troubleshooting guides managed by the directory admin.
- `student_guidance`: the student technician guidance content managed by the directory admin.

`ticket_number` remains an internal database sequence. The user-facing `ticket_reference` is assigned by PostgreSQL as `YY-MM-DD-NNNN` using the `Europe/London` date and a daily counter, such as `26-10-24-0001`.

## Important setup notes

- Keep the database password in a password manager. Never put it in a `VITE_` variable or commit it to Git.
- Do not use a Supabase secret/service-role key in the React app. It bypasses RLS and belongs only in a server-side environment.
- The API provides a Microsoft-authenticated student self-service submission route and a technician walk-up ticket form. Both route to the first active technician at the selected site. Students can view self-service tickets they submitted and walk-up tickets created from their selected Entra directory result; manually typed walk-up tickets are not linked to a student identity. Student access is matched by Entra tenant and object ID, not email. Technician ticket listing is limited to assignments unless `can_view_all_tickets` is explicitly enabled. Updates, status changes, and replies remain limited to tickets assigned to the technician. Escalation only records a demo escalation status; it does not contact TOPdesk or staff IT.
- Students can open a submitted ticket as a full page and reply in its shared conversation. The assigned technician sees the same conversation on the ticket detail page. Comments are visible to both parties. Technician-only notes use the separate `ticket_internal_notes` table and are available only through technician API routes; the student API does not return them. Run migration `011_internal_notes_and_ticket_history.sql` to enable internal notes and ticket history. Existing Supabase projects must run migration `004_ticket_comments.sql` before comments will work, and migration `010_comment_read_receipts.sql` before unread reply counts will work.
- Student replies set the status to `student_updated`; run migration `009_student_updated_status.sql` before using this status on an existing database.
- Knowledge guides and student guidance are stored in Supabase and can be edited by a technician with `can_manage_directory`. Run migration `008_knowledge_content.sql` to create these tables; migration `007_directory_admin.sql` sets the directory-management permission.
- Use Node.js 20 or later, as listed in the project README.
- Use fictional records only in this portfolio demo.

Supabase's database security guide explains RLS and why exposed tables need deliberate grants and policies: <https://supabase.com/docs/guides/database/postgres/row-level-security>.




