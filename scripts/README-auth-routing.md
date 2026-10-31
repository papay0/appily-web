# Auth routing regression checks

`test-auth-routing.mjs` uses the existing Next.js, Clerk, and TypeScript dependencies. It accepts only a local HTTP origin and sends synthetic callback values. It checks prerender manifests, HTML/RSC query isolation, uncached callback/verification routes, and redirect behavior. Signed-in proxy cases use an auth-result fixture; real Clerk form hydration and authenticated redirects still need preview QA.

Build using local fixture configuration (no real service credentials required):

```sh
NEXT_TELEMETRY_DISABLED=1 \
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YXBwaWx5LXVuaXQtdGVzdC5jbGVyay5hY2NvdW50cy5kZXYk \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=appily-local-anon-test \
SUPABASE_SERVICE_ROLE_KEY=appily-local-service-test \
npm run build
```

Start the production build in another terminal. The values below are test fixtures, not credentials:

```sh
NEXT_TELEMETRY_DISABLED=1 \
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YXBwaWx5LXVuaXQtdGVzdC5jbGVyay5hY2NvdW50cy5kZXYk \
CLERK_SECRET_KEY=sk_test_appily_local_only \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=appily-local-anon-test \
SUPABASE_SERVICE_ROLE_KEY=appily-local-service-test \
npm run start -- --hostname localhost --port 3020
```

Then run:

```sh
BASE_URL=http://localhost:3020 node scripts/test-auth-routing.mjs
```

The fixtures intentionally cannot log in or load a real Clerk form. Do not deploy this fixture configuration. Production and preview continue using their existing environment settings.
