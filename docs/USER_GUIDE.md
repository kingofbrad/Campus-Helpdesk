# Demo User Guide

## Purpose

Campus Helpdesk is a concept for giving IT students supervised first-line support experience. The demo illustrates a student technician workspace. It is intended for discussion and portfolio presentation, not operational use.

## Ticket queue

After sign-in, the API identifies the technician by Entra tenant ID and object ID and returns that technician's assigned tickets. The browser displays that authorized response directly. If `can_view_all_tickets` is enabled for a technician record, the queue instead shows tickets from every site and assignment; **My tickets** remains limited to that account's assignments. A cross-site viewer can inspect ticket details and comments, while editing, status changes, and replies stay limited to assigned tickets. Search by ticket reference, issue title, student name, or category. In sample mode, illustrative tickets assigned to the demo technician are held in memory and reset when the page is reloaded.

Ticket references use `YY-MM-DD-NNNN`, such as `26-10-24-0001`. The counter starts at `0001` for each new day in the Europe/London timezone. The queue summary shows open, in-progress, waiting, and resolved counts from the signed-in technician's queue.

The queue keeps its heading and summary in place while the assigned-ticket list scrolls inside its panel. Use **Refresh** in the top bar to fetch the latest assignments immediately. The app also checks every 30 seconds while the dashboard tab is visible. New tickets assigned since the last check and new student replies on your tickets appear in the bell notification centre. Select an alert to open the related ticket, or clear the list when finished. A student reply changes the ticket status to **Updated by student**. Reply alerts are checked while the technician dashboard is open.

Selecting a ticket opens it as a full page. Ticket information is on the left and the shared conversation is on the right; the top and side navigation stay in place while you scroll. The conversation has its own scroll area. You can keep several tickets open in tabs, switch between them, and close a tab with its **X**. Use the queue navigation to return to the list.

## Student self-service portal

Technicians open `/operator` (the site root redirects there) and sign in with Microsoft. Students can open `/student` (for example, `http://localhost:5173/student`) and sign in with Microsoft. The student portal's Campus Helpdesk logo returns to `/student`, while its **Student technician sign in** link opens `/operator`. The `/student` page is the dedicated **Submit a request** page. Their name and email are taken from the signed-in account. They choose their campus site, category, and describe the issue. On submission, the API routes the request to an active student technician at that site and stores it in Supabase. If no active technician is registered for that site, the portal explains that the request cannot be submitted yet.

Students can choose **My submitted tickets** to open `/student/requests`, a separate page listing requests linked to that Microsoft account, with a **Refresh list** button. Tickets are matched by Entra tenant and object ID, not by email address. Self-service tickets are linked automatically. A technician-created walk-up ticket is linked when the technician selects the student's Entra search result. Manually entered walk-up tickets are not linked and will not appear in a student's list. Run `supabase/migrations/003_student_request_identity.sql` before using this feature on an existing database. Tickets created before the identity columns were added do not have a submitter identity attached and will not appear in the student list unless linked separately.

Select one of your tickets (or focus it and press Enter/Space) to open its full-page details. Ticket information appears on the left and the conversation on the right. The portal header and navigation stay visible, and the ticket details and comments scroll independently. Use **My submitted tickets** to return to the list. Students can read helpdesk comments and send replies there. The assigned technician sees and replies to the same conversation on the ticket page. Every comment is shared with both parties; the demo does not provide private notes. Existing Supabase projects must also run migration `004_ticket_comments.sql` to create the comments table.

The technician sign-in page links to the portal. Students need the existing Microsoft sign-in and delegated helpdesk API scope configured. The API validates the Entra token; students do not need a row in the `technicians` table.

## Creating a ticket for a walk-up student

From the technician queue, choose **Create ticket for student** when a student asks for help in person. Search Entra by the student's name or email, then select the matching account to fill in the name and email and link the ticket to that student's self-service account. If you edit the name or email after selecting a directory match, the Entra link is cleared; select the correct directory match again to restore it. The form also tries to match the Entra company name to a configured helpdesk site and fills it in when it finds one. The site dropdown stays editable so the technician can correct the site when needed. If no site match is found, select one manually. Then enter the issue category, summary, description, and initial priority. The server assigns the ticket to the first active technician registered at the selected site and records that it was logged on the student's behalf. This may be a different technician from the one creating the walk-up ticket.

Directory search requires the technician app registration to have Microsoft Graph **delegated** `User.Read.All` permission, with admin consent granted in the Entra tenant. Enter at least two characters; matches are searched by the beginning of the display name, email, or user principal name, and up to ten results are shown. The permission also reads the `companyName` property used for site matching. Personal Microsoft accounts cannot search an organisation's directory; use a work or school technician account in the tenant. If search prompts for access, have the tenant administrator grant the permission, then retry the search.

## Working a ticket

Open a ticket to review the request, requester, category, priority, assignment, and activity notes. Its full-page view keeps ticket information on the left and the shared conversation on the right. Choose **Edit ticket** to correct the student name or email, issue title or description, category, or priority. The ticket site and technician assignment remain unchanged, and the update is recorded in the activity timeline. Available actions are:

- **Mark in progress** updates the assigned ticket's status. The sidebar profile and queue greeting use the signed-in Microsoft profile name.
- **Waiting for student** marks the ticket as awaiting a student response. A reply changes it to **Updated by student** and triggers an in-app notification for the technician.
- **Resolve** changes its status to Resolved.
- **Escalate to IT** opens a handover preview containing the issue, category, priority, troubleshooting notes, and contact details.

Confirming the handover marks the demo ticket as Escalated and assigns it to “Staff IT review.” No email, Teams message, or TOPdesk ticket is created.

## Knowledge base

Choose **Knowledge base** to search troubleshooting articles. Guides cover eduroam, slow devices, account access, printing, classroom equipment, and mobile email. The technician account with directory-management permission can add and edit guides. In Supabase mode, edits are saved to the database; migration `008_knowledge_content.sql` must be applied first. Other technicians can browse the guides but cannot edit them. The demo content is an example; replace it with procedures reviewed and approved by the school before any pilot.

## Student guidance

The guidance page demonstrates safe working principles: understand the request, use approved steps, protect privacy, and escalate issues outside the student technician’s training. The directory manager can edit this guidance in the app; in Supabase mode it is saved to the database and requires migration `008_knowledge_content.sql`.

## Demo data and privacy

Use fictional records only. In Supabase mode, ticket records are persisted; in sample mode, in-memory changes are lost on refresh. Do not enter real student records or confidential school information in this portfolio demo.

## Current limitations

- No Microsoft Forms ingestion
- No email or push notifications, private notes, or file uploads; notifications are in-app only
- No connection to TOPdesk or school support systems
- No production staff approval workflow or operational audit process
- The weekly resolution figure is illustrative

The local API limits ticket listing to the signed-in technician's assignment unless the technician's `can_view_all_tickets` permission is enabled. Ticket updates and replies remain assignment-limited. Site routing selects the first active technician registered at the chosen site. A production design should review routing fairness, audit requirements, data retention, role assignments, and privacy with the organisation's security and system development teams.

Other proposal and future-development topics include Forms ingestion, external notifications, uploads, staff approval, and audit history.

