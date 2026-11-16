# Supabase setup (optional database mode)

The portfolio showcase does not use Supabase. This guide is only for a separate private demo configured with synthetic records.

1. Create a dedicated Supabase project for the demo.
2. Run the SQL migrations in `supabase/migrations/` in order.
3. Configure the private API environment values from `.env.example` in the server environment.
4. Register test technician accounts using fictional test users in a dedicated Entra tenant.
5. Use only fictional students and ticket content.

The server API uses a server-only Supabase secret key. Do not expose that key to the browser, add a `VITE_` prefix, or commit it. Review the database grants and API authorization before any deployment.
# Reference notes only

The public portfolio build does not connect to Supabase. These setup notes are retained as project context; they apply only to a separate private copy of the working project.

