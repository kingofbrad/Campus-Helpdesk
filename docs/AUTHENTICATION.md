# Authentication notes

The public portfolio build is showcase-only. It uses fixed fictional profiles and synthetic UI data; it does not authenticate with Microsoft or persist requests. Its front end cannot be switched into authenticated mode with environment variables.

These notes describe the separate working project, which has the Microsoft Entra and Supabase integration. Configure that project with its own Entra application, API scope, and server-side Supabase credentials. Do not use an organization's live accounts or records in a public demo.

Values prefixed with `VITE_` are included in a browser bundle. Use them only for public identifiers and non-secret configuration. Keep secret keys on the server.
