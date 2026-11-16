# User guide

## Technician workspace

Open `/operator`. The showcase loads as **Alex Morgan** with synthetic tickets. Use the sidebar to open the queue, knowledge base, My tickets, or student guidance. Select a queue row to open the full ticket page. Ticket details, example comments, ticket history, and an internal-notes example are shown in the portfolio preview.

## Student portal

Open `/student` to see the fictional student request form. The name and email are pre-filled for preview. Site, category, priority, and issue details can be entered; submitting creates an in-memory example only. Open **My submitted tickets** or `/student/requests` to view sample requests. These examples are not stored and are cleared on refresh.

## Demo data and privacy

All names, addresses, sites, requests, comments, and notes in showcase mode are fictional examples. Do not put real personal, student, organization, or confidential data into this public portfolio version.

The preview disables Microsoft sign-in and does not connect to Supabase. Normal database mode requires explicit Entra and Supabase configuration, which should use a separate test tenant and entirely synthetic records.
