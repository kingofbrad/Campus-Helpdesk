# Microsoft Entra Sign-in and Directory Search

## Status

Microsoft sign-in is implemented with MSAL. In Supabase mode, the local Node API validates a separate Entra delegated API token, restricts requests to the configured tenant, and looks up the technician by tenant ID plus object ID. It returns assigned tickets by default; a database permission can grant a trusted account read-only visibility across sites. The browser displays the API-authorized ticket list without applying a second personal-queue filter.

Use a separate test app registration for experimentation. A personal Microsoft-account test registration should not be treated as the school’s production identity setup. Later, the school’s Microsoft 365 / Entra administrators should decide the supported account audience, ownership, consent, and access roles for any real student pilot.

## Local environment configuration

Copy `.env.example` to `.env.local` and put the test app's values there. `.env.local` is ignored by Git.

```env
VITE_ENTRA_CLIENT_ID=your-application-client-id
VITE_ENTRA_AUTHORITY=https://login.microsoftonline.com/common/
VITE_ENTRA_REDIRECT_URI=http://localhost:5173/
```

Vite exposes variables prefixed with `VITE_` to frontend code. Their values are included in the browser bundle and visible to users. Client IDs and tenant IDs are identifiers, not passwords, so they are suitable for this configuration. Never put a client secret, API key, password, or other credential in a `VITE_` variable.

For this demo, the `common` authority matches the app registration audience for any Microsoft Entra tenant plus personal Microsoft accounts. Use a tenant-specific authority instead when you want the sign-in itself limited to one tenant or when authenticating invited guests in that tenant's context. `consumers` is for personal Microsoft accounts only, and `organizations` is for work/school accounts only. Vite reads `.env.local`; `.env.example` is only a template to copy.

## Before starting

1. Install the MSAL packages in the project:

   ```powershell
   npm install @azure/msal-browser @azure/msal-react
   ```

2. Register a test application in the Microsoft Entra admin center.
3. Select a supported account type that includes personal Microsoft accounts. If the app should accept only consumer accounts during testing, choose **Personal Microsoft accounts only**. If it should accept both consumer and work/school accounts, choose the combined option.
4. Under Authentication, add a **Single-page application (SPA)** redirect URI matching the local Vite origin, normally `http://localhost:5173/`.
5. Copy the Application (client) ID into `.env.local`.

Microsoft documents supported audiences in [Register an application](https://learn.microsoft.com/en-us/entra/identity-platform/howto-create-service-principal-portal) and authority URLs in [MSAL client application configuration](https://learn.microsoft.com/en-us/entra/identity-platform/msal-client-application-configuration). For personal-only accounts, the authority is `https://login.microsoftonline.com/consumers/`; for work/school plus personal accounts, use `https://login.microsoftonline.com/common/`. The authority must match the app registration’s supported account type.

## Technician-specific ticket view

The demo requests delegated Microsoft Graph `User.Read` to show the signed-in user's display name. In sample mode, assignments use the account username as a demo identifier. In database mode, the API uses validated Entra `tid` and `oid` claims to find the technician row, then filters the database query by that technician's database ID. The browser treats this API response as authoritative; it does not filter the personal queue a second time.

Sample mode uses client-side filtering of synthetic data. Database mode calls the local API, which validates the token and enforces ticket visibility and assigned-ticket write access. The `can_view_all_tickets` database permission grants read-only cross-site visibility; ticket edits, status actions, and replies still require assignment. The local API uses the Supabase secret key only on the server. This remains a portfolio prototype: have the organisation's security and development teams review it before using real student data.

The app reads its MSAL configuration from `src/config/auth-config.js` and wraps the React tree in `MsalProvider` in `src/main.jsx`. Sign-in requests `User.Read`; database mode additionally requests `api://<application-client-id>/access_as_user`. Restart the Vite and API processes after changing `.env.local`. Test the redirect URI exactly; `localhost` and `127.0.0.1` are different browser origins. See [Supabase setup](SUPABASE_SETUP.md) for the API scope and technician registration steps.

## Technician student-directory search

The technician walk-up ticket form searches students through Microsoft Graph `GET /users`. In **App registrations → your technician SPA → API permissions**, add **Microsoft Graph → Delegated permissions → `User.Read.All`**, then grant admin consent in the tenant. This is separate from the custom `access_as_user` permission that authorizes the SPA to call the local helpdesk API. The demo searches by the beginning of a student's display name, email, or user principal name and reads `companyName` to match the configured helpdesk site. Search starts at two characters and shows up to ten results. `User.ReadBasic.All` does not include `companyName`, so it is not enough for this site-prefill behavior. Directory enumeration does not work when the technician is signed in with a personal Microsoft account; use an internal work or school account in the tenant.

`User.Read.All` allows the signed-in app to read user profiles across the directory and requires administrator consent. It is broader than the existing `User.Read` sign-in permission. Use it only for this isolated demo tenant and fictional test users unless the organisation's Entra and security administrators approve the permission and its use. No client secret is needed, and this permission does not go in `.env.local`.

For a SPA, Microsoft recommends authorization code flow with PKCE. MSAL handles the protocol details. See [React SPA configuration](https://learn.microsoft.com/en-us/entra/identity-platform/scenario-spa-app-configuration) and [authentication flow guidance](https://learn.microsoft.com/en-us/entra/identity-platform/msal-authentication-flows).

## Security notes

- Never add a client secret to this React app. All JavaScript delivered to the browser can be inspected.
- A successful sign-in proves identity only. In database mode, the API adds the demo's authorization checks; Supabase's secret key bypasses RLS and must remain server-only.
- Use fictional ticket records in the portfolio demo. Before a school pilot, have the responsible Entra administrators and security team review the API, technician onboarding, data retention, and access model.
- Before a school pilot, have the responsible Entra administrators approve the app registration and decide how student technician roles will be assigned and enforced.

