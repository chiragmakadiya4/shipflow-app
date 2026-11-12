# ShipFlow Supabase + Next.js Setup

The web application now uses Next.js App Router and Supabase's SSR helpers. The integration is intentionally split into server, browser, and middleware clients so auth cookies are refreshed correctly without exposing a service-role key.

## Local setup

From the repository root:

```bash
cp apps/web/.env.local.example apps/web/.env.local
```

Set these values in `apps/web/.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

The publishable key is suitable for browser use only when Supabase Row Level Security is enabled. Never add a service-role key to `.env.local.example`, browser code, Git, or Vercel client-visible variables.

## Client boundaries

- `apps/web/utils/supabase/server.ts` creates the server client for Server Components and Server Actions.
- `apps/web/utils/supabase/client.ts` creates the browser client for interactive client components.
- `apps/web/utils/supabase/middleware.ts` refreshes auth sessions and forwards updated cookies.
- `apps/web/middleware.ts` applies the session refresh to application routes.
- `apps/web/app/page.tsx` demonstrates an authenticated server-side query against `projects`.

## Supabase project configuration still required

1. Create or select the Supabase project.
2. Configure the email/OAuth providers needed for the demo.
3. Apply the ShipFlow database migrations. The current schema uses application-level users and must be reconciled with `auth.users` before production RLS is enabled.
4. Add RLS policies so each authenticated user can read only projects belonging to an organization where they have membership.
5. Configure the same two variables in the Vercel Preview/Staging and Production environments.
6. Set the Supabase Auth redirect URLs for local development and the Vercel deployment domains.

## Verification

Run from the repository root:

```bash
pnpm check
pnpm build
```

The current build does not require live Supabase credentials because the route is rendered on demand. A configured project is required to exercise authentication and project data end to end.
