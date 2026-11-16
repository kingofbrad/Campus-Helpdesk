# Campus Support Desk

A portfolio-ready prototype of a student support desk, built with React, Vite, Chakra UI, Microsoft Entra ID, and an optional server-side Supabase API.

## Portfolio preview

The public deployment runs in showcase mode with fictional records and skips sign-in. It does not connect to Entra, Supabase, or any organization. Request submissions and replies are held in browser memory and disappear on refresh.

```powershell
npm install
npm run dev
```

Open `http://localhost:5173/operator` for the technician workspace, `http://localhost:5173/student` for the request form, and `http://localhost:5173/student/requests` for a sample student’s submitted tickets.

This portfolio copy is showcase-only; authentication and database integrations are disabled. The original working project contains the authenticated version. Never commit `.env.local`, Entra client secrets, Supabase secret keys, real account details, or real ticket records.

## Features represented

- Technician queue with search and status/priority filters
- Full-page ticket details, conversation, technician-only notes, and activity history
- Student request form and submitted ticket list
- Knowledge base and student guidance
- Site-based ticket routing in database mode

The showcased campus names and all sample people are fictional. The app is a portfolio demonstration, not an endorsed or production service.

## Project structure

- `src/` React application, UI components, and demo data
- `server/` authenticated API for database mode
- `api/` is excluded from the public portfolio deployment
- `supabase/migrations/` database schema changes
- `docs/` safe setup and user notes
- `portfolio-screenshots/` captured images for portfolio use

## Optional database mode

This portfolio copy does not deploy a server or API. The backend and setup references are retained for context only; the original working project contains the authenticated database integration. Never use real organization records in a public demo.
