# Student Helpdesk Prototype

A portfolio prototype for a student-run first-line IT helpdesk. Student technicians can review assigned requests, consult troubleshooting guidance, record ticket activity, and preview an escalation handover for staff.

## Project status

The app uses Microsoft Entra sign-in. It can run with synthetic in-memory tickets, or connect to Supabase through a local Node API when configured. The student portal is at `/student`; the technician workspace is at `/operator`. In database mode, student requests and technician walk-up tickets are stored in Supabase and routed to the first active technician at the selected site. A walk-up ticket is linked to the student's Entra account when the technician selects that account from directory search. Manually entered walk-up details are not linked to a student account. The app is not connected to Microsoft Forms or TOPdesk. Escalation only records a demo status; it does not notify staff or create a TOPdesk incident. Use fictional records only.

## Run the project

Requires Node.js 20 or newer.

```powershell
npm install
npm run dev
```

For the Supabase-backed mode, complete [Supabase setup](docs/SUPABASE_SETUP.md), then run `npm run dev:api` in a second terminal. Without `VITE_ENTRA_API_SCOPE`, the UI stays in sample in-memory mode.

Open `http://localhost:5173/operator` for the technician workspace or `http://localhost:5173/student` for the student portal. The site root redirects to the operator workspace. To make a production build:

```powershell
npm run build
```

If PowerShell blocks `npm.ps1`, run the Windows command shim instead:

```powershell
npm.cmd install
npm.cmd run dev
```

## Demo features

- Ticket queue with search and status/priority filters
- Date-based ticket references with a daily counter, for example `26-10-24-0001`
- Personal ticket queue showing only tickets assigned to the signed-in technician
- Optional read-only, cross-site ticket visibility for trusted technician accounts
- Manual refresh and 30-second new-ticket checks with an in-app notification centre
- In-app alerts when students reply to assigned tickets
- Full-page technician ticket details with requester, issue, assignment, activity, and shared comments
- Multiple open technician tickets in tabs, with fixed navigation while viewing a ticket
- Technician ticket editing with assignment checks and an activity record
- Assign, mark in progress, wait for a student, resolve, and simulated escalation actions
- Student replies update the ticket status and notify the assigned technician
- Searchable knowledge base with common Wi-Fi, device, account, printing, and classroom guides
- Student technician guidance on privacy and when to escalate
- Admin editing for knowledge base articles and student guidance
- Student self-service ticket submission, personal ticket history, and full-page ticket details with a shared conversation
- Shared ticket comments where students and assigned technicians can read and reply
- Technician ticket creation on a student behalf
- Entra student directory search that fills in the requester name, email, and matching site for walk-up tickets
- Student self-service visibility for requests submitted by the student and walk-up requests linked to their selected Entra account
- Site-based assignment to the first active technician registered at that site
- Responsive layout for narrow screens

## Project structure

```text
student-helpdesk-react/
├── docs/
│   ├── AUTHENTICATION.md
│   ├── SUPABASE_SETUP.md
│   └── USER_GUIDE.md
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── config/
│   │   └── auth-config.js
│   ├── components/
│   │   ├── auth/                 # Sign-in, pending, and profile-loading screens
│   │   ├── operator/             # Technician navigation, queue pages, dialogs, and ticket details
│   │   ├── shared/               # Reusable layout pieces, cards, and modal
│   │   ├── student/              # Student request form, ticket list, and full-page ticket details
│   │   └── tickets/              # Ticket forms and conversations
│   ├── data/
│   │   └── demo-data.js           # Sample tickets, guides, and display palettes
│   ├── hooks/
│   │   ├── useOperatorWorkspace.js
│   │   └── useTechnicianIdentity.js
│   ├── pages/
│   │   ├── OperatorWorkspace.jsx  # Composes the technician workspace
│   │   └── StudentPortal.jsx      # Composes student sign-in, request, and history pages
│   ├── services/
│   │   ├── entra-directory.js     # Microsoft Graph student directory search
│   │   └── ticket-api.js          # Browser-side ticket API calls
│   ├── styles/
│   │   └── main.css
│   └── utils/
│       └── helpdesk.js            # Shared display and demo helpers
├── server/
│   └── index.js
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_server_api_grants.sql
│       ├── 003_student_request_identity.sql
│       ├── 004_ticket_comments.sql
│       ├── 005_daily_ticket_references.sql
│       ├── 006_technician_team_visibility.sql
│       ├── 007_directory_admin.sql
│       ├── 008_knowledge_content.sql
│       └── 009_student_updated_status.sql
├── index.html
├── package.json
└── vite.config.js
```

`App.jsx` is intentionally small: it hands off to `OperatorWorkspace`. Page components assemble the screen from smaller components, hooks own reusable state and behavior, and `services/` contains the calls to the local API. This keeps visual pieces separate from ticket data and authentication logic.

## Technology

- React
- Chakra UI v3
- Vite
- React Icons
- Node.js built-in HTTP and Fetch APIs for the local demo API

## Documentation

- [Demo user guide](docs/USER_GUIDE.md)
- [Microsoft Entra sign-in setup notes](docs/AUTHENTICATION.md)
- [Supabase schema and local API setup](docs/SUPABASE_SETUP.md)
- [Demo deployment and custom-domain setup](docs/DEPLOYMENT.md)

## Local environment variables

Copy `.env.example` to `.env.local` and add your Entra and Supabase settings. Values beginning with `VITE_` are included in browser code; use them only for public identifiers and the API scope. The Supabase secret key must stay in a server-only variable without the `VITE_` prefix. See [authentication](docs/AUTHENTICATION.md) and [Supabase setup](docs/SUPABASE_SETUP.md).

