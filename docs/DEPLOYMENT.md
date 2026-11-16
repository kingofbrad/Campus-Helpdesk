# Deployment notes

The portfolio preview can be deployed to a static host such as Vercel. It runs entirely on synthetic in-browser examples and does not require credentials or a database. The showcase behavior is built in and cannot be disabled through deployment environment variables.

This repository's Vercel configuration deploys only the static front end. For a private, authenticated database-backed deployment, use the separate working project and configure its Entra and Supabase services independently. Never put a Supabase secret key in a `VITE_` variable or in Git.

The project is a demonstration, not an endorsed or production service.
