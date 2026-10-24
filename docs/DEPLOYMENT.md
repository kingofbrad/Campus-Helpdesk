# Vercel Demo Deployment

The app is a Vite React frontend with a Node.js ticket API. The frontend deploys as static files, while the Vercel function in `api/[...path].js` routes API calls through the same handler used for local development. Vercel documents automatic Vite builds, project environment variables, and Node.js functions in its [Vite guide](https://vercel.com/docs/frameworks/frontend/vite), [Functions guide](https://vercel.com/docs/functions), and [environment variables guide](https://vercel.com/docs/environment-variables).

## Before publishing

- Keep `.env.local` out of Git. It contains the Supabase server secret and is ignored by `.gitignore`.
- Use fictional test accounts and ticket data only. This is a portfolio demo, not an approved service for real student information.
- Keep the Supabase secret key in Vercel's server environment settings. Never add it to a `VITE_` variable or commit it.
- Use `helpdesk.brking.dev` as a dedicated subdomain so the existing portfolio site stays untouched.

## Connect the private GitHub repository

1. Create a **private** GitHub repository and push this project to it. Make sure `.env.local` is not staged or committed.
2. In Vercel, choose **Add New → Project**, connect GitHub, and import the repository.
3. Keep the Vite framework preset. The project includes `vercel.json` with the Vite build, `dist` output, SPA route fallback, and London function region (`lhr1`).
4. Add the environment variables below to the **Production** environment before the first deployment.
5. Deploy and wait for the build to finish. The app routes are `/student` and `/operator`; the API health endpoint is `/api/health`.

The production function is configured for London to be near the project's European Supabase region. Vercel supports configuring function regions in [`vercel.json`](https://vercel.com/docs/functions/configuring-functions/region).

## Production environment variables

Set these in **Project Settings → Environment Variables**. Vercel applies environment changes to new deployments, so redeploy after changing them. The `VITE_` variables are included in the public browser bundle; client IDs, authority, redirect URI, and API scope are identifiers/configuration, not secrets.

| Variable | Value |
| --- | --- |
| `VITE_ENTRA_CLIENT_ID` | Client ID of the existing SPA app registration |
| `VITE_ENTRA_AUTHORITY` | `https://login.microsoftonline.com/common/` for the current mixed-account test setup |
| `VITE_ENTRA_REDIRECT_URI` | `https://helpdesk.brking.dev/` |
| `VITE_ENTRA_API_SCOPE` | Custom API scope, for example `api://<API-app-client-id>/access_as_user` |
| `ENTRA_API_CLIENT_ID` | Client ID of the separate Entra API app registration |
| `ENTRA_TENANT_ID` | Demo Entra tenant ID |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Server-only Supabase secret key |

Set the `VITE_` values for **Production** so Vite can read them during the build. Set the remaining four server values for **Production** so the API function can read them at runtime. Do not set `VITE_` on the Supabase secret key.

## Entra redirect URI

In the SPA app registration, add the deployed origin as a **Single-page application (SPA)** redirect URI. It must exactly match `VITE_ENTRA_REDIRECT_URI`, including `https://` and the final slash. Keep `http://localhost:5173/` for local development. The separate API app registration and `access_as_user` permission stay as configured for the prototype.

## Add your portfolio domain

1. In Vercel **Project Settings → Domains**, add `helpdesk.brking.dev`.
2. Follow the DNS record Vercel shows and create it with your domain provider. Do not change the portfolio's root-domain records.
3. After Vercel confirms HTTPS, set `VITE_ENTRA_REDIRECT_URI` to `https://helpdesk.brking.dev/`.
4. Add that exact redirect URI to the SPA registration, then redeploy.

## Demo access and limitations

Share `/student` for student requests and `/operator` for the student-technician workspace. The API only accepts tokens from the configured Entra tenant; only active technician records can access the operator queue. Escalation is a preview status only: this prototype does not create TOPdesk tickets or notify staff. Keep it for fictional/demo records until the organisation's security, privacy, and development teams review any real-world use.


