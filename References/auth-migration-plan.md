# Auth Migration & Production Deployment Plan

Migrating from `PROTOTYPE_USER_ID` hardcoded auth to real Supabase user auth, deploying to invoice.jessemorley.com.

**Key fact:** jessmorley@gmail.com already exists in Supabase Auth with UUID `8d8d8e2f-fbe9-4651-b460-c92698460cb1` — matches the prototype UUID. No data migration needed.

---

## Phase 1 — Supabase dashboard config

- [x] Verify jessmorley@gmail.com auth user UUID = `8d8d8e2f-fbe9-4651-b460-c92698460cb1`
- [x] Set Site URL → `https://invoice.jessemorley.com`
- [x] Add `https://invoice.jessemorley.com/**` to Redirect URLs allowlist
- [x] Disable new user signups (Authentication → Settings)

---

## Phase 2 — RLS migration

- [x] Create `supabase/migrations/20260503000000_enable_rls.sql`
  - Enable RLS on all 8 user-scoped tables: `business_details`, `clients`, `entries`, `expenses`, `invoice_line_items`, `invoice_sequence`, `invoices`, `scheduled_emails`
  - Add `user_id::uuid = auth.uid()` policy on each table (`user_id` is `text`, cast it to `uuid`)
  - Add storage bucket policy for `receipts` bucket (path prefix = `auth.uid()`)
- [x] Apply with `npx supabase db push --linked`

> Once Phase 4 switches Next.js to the anon key, RLS becomes the primary data isolation layer. The service role key is removed from Next.js entirely after that.

---

## Phase 3 — Auth infrastructure

- [x] Create `src/middleware.ts`
  - Use `@supabase/ssr` + anon key to refresh session cookies on every request
  - Use `supabase.auth.getClaims()` (not `getSession()`) to validate the JWT cryptographically
  - Redirect unauthenticated users to `/login`
  - Exempt `/api/*`, `/login`, and static assets from redirect
  - Ensure middleware response is never cached (set `Cache-Control: private, no-store`)
- [x] Create `src/app/login/page.tsx`
  - Email/password form styled with existing shadcn/ui components
- [x] Create `src/app/login/actions.ts`
  - `signIn(formData)` — calls `supabase.auth.signInWithPassword`, redirects to `/` on success, returns error message on failure
  - `signOut()` — calls `supabase.auth.signOut`, redirects to `/login`
- [x] Create `src/lib/supabase-server.ts` — replaces current `src/lib/supabase.ts`
  - `createClient()` — creates a cookie-based SSR client using `@supabase/ssr` + anon key for use in server actions and route handlers

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {} // middleware handles cookie writing for Server Components
        },
      },
    }
  )
}
```

- [x] Create `src/lib/auth.ts`
  - `getAuthUserId(): Promise<string>` — creates SSR client, calls `supabase.auth.getClaims()` (validates JWT), returns `claims.sub`, throws if unauthenticated

```ts
export async function getAuthUserId(): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) throw new Error("Unauthenticated")
  return data.claims.sub
}
```

---

## Phase 4 — Replace PROTOTYPE_USER_ID + switch to anon key

- [x] `src/lib/supabase.ts` — remove `PROTOTYPE_USER_ID` export; replace `createServerClient` (service role) with re-export of `createClient` from `src/lib/supabase-server.ts`
- [x] `src/app/(app)/actions.ts` — replace all 5 loader functions
- [x] `src/app/(app)/entries/actions.ts` — replace all 6 functions
- [x] `src/app/(app)/invoices/actions.ts` — replace all 12 functions
- [x] `src/app/(app)/clients/actions.ts` — replace all 3 functions
- [x] `src/app/(app)/expenses/actions.ts` — replace all 5 functions
- [x] `src/app/(app)/settings/actions.ts` — replace all 6 functions

Pattern for each:
```ts
// Before
import { createServerClient, PROTOTYPE_USER_ID } from "@/lib/supabase"
const supabase = createServerClient()
...eq("user_id", PROTOTYPE_USER_ID)

// After
import { createClient } from "@/lib/supabase-server"
import { getAuthUserId } from "@/lib/auth"
const [supabase, userId] = await Promise.all([createClient(), getAuthUserId()])
...eq("user_id", userId)  // belt-and-suspenders; RLS also enforces this
```

> `src/lib/queries.ts` already accepts `userId` as a parameter — no changes needed there. The `.eq("user_id", userId)` clauses are kept as belt-and-suspenders; RLS is now the primary guard.

---

## Phase 5 — Secure API routes

- [x] `src/app/api/invoices/[id]/pdf/route.ts`
  - Add dual auth: session cookie (browser requests) via `getClaims()` **or** `Authorization: Bearer <INTERNAL_API_SECRET>` header (edge function requests)
  - If neither is valid, return 401
  - For the secret-bearer path, fetch the invoice's `user_id` using the service role client (kept only here for this server-to-server use case)
- [x] `src/app/api/expenses/[id]/receipt/route.ts`
  - Replace `PROTOTYPE_USER_ID` with `getAuthUserId()`

---

## Phase 6 — Sign-out UI

- [x] Add sign-out button to `src/components/app-nav.tsx` (sidebar footer)
- [x] Calls the `signOut` server action from `src/app/login/actions.ts`

---

## Phase 7 — Environment variables

### Local `.env.local`
- [ ] Remove `PROTOTYPE_USER_ID`
- [ ] Remove `SUPABASE_SECRET_KEY` (no longer used in Next.js)

### Vercel
- [x] Generate `INTERNAL_API_SECRET`: `openssl rand -hex 32`
- [x] Add `INTERNAL_API_SECRET` to Vercel project environment variables
- [x] Remove `PROTOTYPE_USER_ID` from Vercel environment variables
- [x] Remove `SUPABASE_SECRET_KEY` from Vercel environment variables
- [x] Confirm these vars are present and correct:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

### Supabase edge function secrets
- [x] Add `INTERNAL_API_SECRET` (Dashboard → Functions → Secrets)
- [x] Confirm `SUPABASE_SERVICE_ROLE_KEY` is present (edge functions need it; it never leaves Supabase)

---

## Phase 8 — DNS & domain

- [x] Add `invoice.jessemorley.com` in Vercel → Settings → Domains
- [x] Add DNS record (CNAME `invoice` → `cname.vercel-dns.com`, or A record per Vercel instructions)
- [x] Confirm Vercel provisions TLS certificate

---

## Verification checklist

- [ ] `/login` page renders correctly
- [ ] Sign-in with jessmorley@gmail.com credentials succeeds and redirects to `/`
- [ ] Unauthenticated request to `/` redirects to `/login`
- [ ] All views load correctly: dashboard, entries, invoices, clients, expenses, settings
- [ ] Create/edit/delete entry works
- [ ] PDF download works from browser
- [ ] Schedule email + send email works (edge function → PDF route via `INTERNAL_API_SECRET`)
- [ ] Sign-out clears session and redirects to `/login`
- [ ] `PROTOTYPE_USER_ID` and `SUPABASE_SECRET_KEY` removed from Vercel — app still works
- [ ] RLS check: direct DB query with wrong user returns empty results

---

## Security issues resolved

| Issue | Severity | Phase |
|---|---|---|
| No RLS — entire DB exposed if service key leaks | High | 2 |
| Service role key in Next.js/Vercel env vars | High | 4, 7 |
| Hardcoded user ID = unauthenticated access to all data | High | 4 |
| PDF route callable by anyone with a valid invoice UUID | High | 5 |
| Receipt upload route unauthenticated | High | 5 |
| `getSession()` used server-side (unverified JWT) | Medium | 3 |
| No session management / no logout | Medium | 3, 6 |
| No storage bucket policy | Low | 2 |
