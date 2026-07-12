# Multi-user roadmap

Research notes (July 2026) on what it would take to make this a fully-functioning
multi-user app: separate users connecting their own email, importing existing
data, etc.

## Where the app stands

The data layer is already mostly multi-user. Every table has `user_id`, RLS is
enabled with `auth.uid()` policies, every query filters by `userId`, and Inngest
jobs are keyed per user. The app is single-user by *circumstance* (no signup,
one hardcoded sender) more than by architecture.

## What's required, by area

### 1. Signup & account lifecycle (small)

`src/app/login/actions.ts` only has `signInWithPassword` — there is no signup
path at all. Needed:

- Signup form calling `supabase.auth.signUp` + email confirmation (Supabase
  handles the emails; customize templates in the dashboard)
- Password reset flow (`resetPasswordForEmail` + a reset page)
- Account deletion (admin API call + cascade; required if you take strangers' data)

### 2. Data isolation gaps (small but important)

- **`client_workflow_rates` is a hole.** It appears in no migration and isn't in
  `20260503000000_enable_rls.sql`, and `fetchWorkflowRates` (`src/lib/queries.ts`)
  is the only query with **no `user_id` filter**. If RLS isn't enabled on that
  table in the live DB, user B sees user A's rates. Verify in the dashboard; add
  the policy + filter regardless.
- The storage RLS migration only covers the `receipts` bucket. Sent PDFs go to
  an `invoices` bucket (`send-invoice-email.ts`) under a `user_id/` prefix —
  confirm that bucket has the same prefix policy.

### 3. Email sending — the biggest design decision

`send-invoice-email.ts` hardcodes `from: Jesse Morley <FROM_ADDRESS>`. Three
rungs, in order of effort:

1. **Send from app domain, per-user display name + reply-to** (recommended
   first step): `from: "${businessName} <invoices@yourapp.com>"`,
   `reply_to: user.email`. Zero user setup, good deliverability, ~5 lines
   changed. This is what most invoicing SaaS (Wave, etc.) actually do.
2. **Per-user verified domain via Resend's Domains API**: user adds DNS
   records, you poll verification, then send as `billing@theirdomain.com`.
   Real feature work (settings UI, DNS instructions, verification state
   machine) and high user friction — most sole traders don't control DNS.
3. **OAuth send-as-user (Gmail/Outlook APIs)**: emails genuinely come from
   their mailbox and land in their Sent folder. But Google's `gmail.send`
   scope requires OAuth app verification + a CASA security assessment — weeks
   of process. Only worth it if it's a headline feature.

Do rung 1 now; rung 2 later as a power-user option.

### 4. De-personalizing the product (the decision that shapes everything else)

The app is deeply shaped as an **Australian sole-trader retoucher/photographer**:

- **Australian everywhere**: `todayInSydney()`, `en-AU` formatting, Jul–Jun
  financial year, ABN, superannuation, GST flags, PAYG instalments, and
  `tax-estimate.ts` hardcodes ATO brackets + Medicare + HECS.
- **Domain-specific entry model**: `workflow_type`, `skus`, `shoot_client`,
  `brand`, per-SKU KPI bonus rates.

Multi-user **within the same niche** (Australian freelance creatives) needs
almost none of this changed — just per-user timezone in `user_preferences`
instead of hardcoded Sydney. Going **general/international** means rebuilding
the tax view, FY logic, and generalizing the entry schema — effectively a
different product. Decide the market before writing any code; the niche
version is the one worth building.

### 5. Onboarding (medium)

A fresh user has no `business_details`, `invoice_sequence`, or
`user_preferences` rows. The settings actions already upsert, and queries
return `null` gracefully, but you'd want: a first-run wizard (business
name/ABN/bank details → invoice prefix + starting number → first client), and
defaults for `user_preferences`. Also the weekly-reminder Inngest chain is
bootstrapped by a settings change — make sure enabling it during onboarding
kicks off the first event.

### 6. Data import (medium — currently nothing exists)

- **CSV import for clients** (name, email, address, rates) — cheap, high value
- **CSV import of historical paid invoices** (date, client, total) so
  dashboard/tax views aren't empty year one — import as invoices with no line
  items
- **Invoice sequence starting number** (already exists via settings — just
  surface it in onboarding)

Skip importing full historical entries/line-items from other tools; nobody's
data maps cleanly and start-fresh is acceptable for time entries.

### 7. Caching & scale housekeeping (defer until it matters)

- Cache tags are global strings — `revalidateTag("entries")` expires *every*
  user's entries cache. No data leak (cache keys include the userId/token
  args), just wasted refetches. Fix later by suffixing tags with userId.
- The `"use cache"` key includes the JWT, which rotates each session — hit
  rates will be poor with many users. Same fix.
- Quotas: Resend free tier is 100 emails/day; Inngest and Supabase free tiers
  have limits — fine for tens of users, budget for more.

### 8. If it's commercial

Stripe billing, ToS/privacy policy (holding other people's financial records —
Supabase backups + a data-export button), and rate limiting on the login and
PDF endpoints. All standard, all deferrable until there's a second real user.

## Suggested order

1. **Phase 1 — safe multi-tenancy**: `client_workflow_rates` RLS + filter,
   `invoices` bucket policy check, signup + password reset, from-address →
   business name + reply-to. (~a few days)
2. **Phase 2 — strangers can succeed**: onboarding wizard, per-user timezone,
   CSV client import. (~a week)
3. **Phase 3 — polish**: historical invoice import, custom sending domain,
   per-user cache tags, billing.

The single biggest fork in the road is #4: same-niche multi-user is Phase 1–2
work; a general invoicing app is a rewrite of the tax/entry layer. Everything
above assumes the niche version.
