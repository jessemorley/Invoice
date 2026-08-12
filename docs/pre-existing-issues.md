# Pre-existing issues

Running log of lint/type/build warnings that exist on `main` but are unrelated to whatever change is in flight. Recorded so they're not silently re-encountered and so we know what's safe to ignore vs. fix.

When you hit one of these during a task, do **not** fix it inline — that bloats the diff and muddies review. Either:

1. Add it here (with date + context) if it's new, or
2. Leave it alone if it's already listed, or
3. Open a dedicated branch/PR if you actually want to address it.

## Open

### type error: `cc_address` optional vs nullable — src/components/sent-email-sheet.test.tsx:16

- First noted: 2026-08-12
- Rule: `tsc` TS2322
- Symptom: test fixture builds `cc_address` as `string | null | undefined`, but `DashboardEmail` declares `string | null`. Surfaces under `npx tsc --noEmit`; `npm run build` does not fail because test files are excluded from the build's type-check.
- Fix: not attempted. Confirmed present on `main` (unrelated to the FY expense filters / WFH deduction work). Either widen `DashboardEmail.cc_address` to optional or make the fixture supply an explicit `null`.

## Resolved

### cookie-based `createClient()` inside server actions — not a defect, doc was wrong

- First noted: 2026-08-12
- Resolved: 2026-08-12 (invalid — CLAUDE.md amended instead)
- Rule: CLAUDE.md auth pattern ("Never use the cookie-based `createClient()` inside server actions")
- Symptom: `src/app/(app)/tax/actions.ts` used `createClient()` rather than `getAuth()` + `createTokenClient(token)`.
- Finding: the sweep showed all 8 server action files use the cookie client — ~45 call sites across clients, entries, expenses, invoices, settings, tax. `createTokenClient` appears **only** in `src/lib/queries.ts`. Both clients are anon-key clients carrying the user's JWT, so both respect the `auth.uid()` RLS policies; neither is service-role. `getAuth()` is itself built on `createClient()` (`src/lib/auth.ts:5`), so the documented pattern does not avoid the cookie client — it just extracts the token from one. The rule described a pattern that never applied to actions or routes, and converting ~45 sites would have been a no-op diff.
- Fix: rewrote the CLAUDE.md "Auth pattern" section to state the real rule (cookie client in actions/routes, token client in `"use cache"` functions, because `cookies()` is unavailable there). No source files changed.
- Follow-up (not done): `src/app/(app)/invoices/actions.ts:107,304,370,484` call `createClient()` + `getAuthUserId()` + `getAuthToken()`, constructing three cookie clients per request where one `getAuth()` would do. Minor redundancy, separate change.

### test suite broken: matchMedia missing, stale dock expectations, tax-estimate collecting 0 tests (14 tests / 3 files)

- First noted: 2026-07-19 (during feature/emails-view and feature/emails-mobile-view)
- Resolved: 2026-08-07 (fix/vitest-suite)
- Symptom: `npm test` failed 3 files / 14 tests total on clean `main` (10 failed tests + 1 file collecting 0 tests): `sent-email-sheet.test.tsx` (6/6, `window.matchMedia is not a function` from `src/hooks/use-mobile.ts`), `floating-dock.test.tsx` (4/15, stale expectations from a pre-redesign dock layout), and `tax-estimate.test.ts` (bare top-level `approx()` calls with no `describe`/`it`, so vitest collected nothing).
- Fix:
  1. Added a `window.matchMedia` stub to `src/test/setup.ts` — fixed `sent-email-sheet.test.tsx` and unmasked the real state of `floating-dock.test.tsx`.
  2. Confirmed the 4 `floating-dock` failures were genuinely stale (not just masked): "Plus disabled when view is clients" (Plus is now enabled for clients via `DOCK_NEW_VIEWS`) and three overflow-menu tests asserting on a "Dashboard" button in the popover (Dashboard is now a primary tab, not a secondary/menu item). Updated the assertions to match current behavior — clients-view Plus is now asserted enabled, and the menu tests use "Clients" (a real secondary item) instead of "Dashboard".
  3. Wrapped `tax-estimate.test.ts` in `describe`/`it` with `expect` so the tax bracket/Medicare/HECS assertions actually execute.
- Verified: `npx vitest run` → 6 files / 50 tests passing. `npm run lint` and `npm run build` clean.

### lint warning: unused `Label` import — src/components/client-sheet.tsx:29

- First noted: 2026-06-10
- Resolved: 2026-06-11 (#74)
- Rule: `@typescript-eslint/no-unused-vars`
- Symptom: `Label` was imported but not referenced anywhere in the file.
- Fix: removed the dead import.

### lint: `setState` synchronously inside effect — src/components/client-sheet.tsx:834

- First noted: 2026-06-10
- Resolved: 2026-06-11 (#69)
- Rule: `react-hooks/set-state-in-effect`
- Symptom: `setRates(null)` called synchronously in the early-return branch of a `useEffect` guarded by `!open`.
- Fix: moved the reset into the sheet's `onOpenChange` close handler; the effect now only fetches when open.

### lint: `setState` synchronously inside effect — src/components/workflow-rates-section.tsx:122

- First noted: 2026-06-10
- Resolved: 2026-06-11 (#69)
- Rule: `react-hooks/set-state-in-effect`
- Symptom: `setForm(rateToForm(savedData))` called synchronously inside an effect that syncs form state from a saved record after a save roundtrip.
- Fix: replaced the effect with the adjust-state-during-render pattern (track previous `savedData` in state, sync `form` during render when it changes).

### lint: `setState` synchronously inside effect — src/components/floating-dock.tsx:41

- First noted: 2026-05-25
- Resolved: 2026-06-11 (stale — no longer reproduces)
- Rule: `react-hooks/set-state-in-effect`
- Symptom: `setPillVisible(false)` called inside an effect body.
- Fix: none needed. The setState now runs inside a `requestAnimationFrame` callback (asynchronous), which the rule does not flag. Verified absent from `npm run lint` output on 2026-06-11.

### lint warning: unused `sendPushToUser` export — src/app/(app)/settings/actions.ts:7

- First noted: 2026-06-10
- Resolved: 2026-06-11 (stale — no longer reproduces)
- Rule: `@typescript-eslint/no-unused-vars`
- Symptom: `sendPushToUser` was exported from settings actions but not imported anywhere.
- Fix: none needed. The function now lives in `src/lib/push.ts` and is imported by the Inngest functions (`send-invoice-email.ts`, `weekly-invoice-reminder.ts`).

### lint warning: unused `scheduled_for` in Inngest send handler — src/inngest/send-invoice-email.ts

- First noted: 2026-05-25
- Resolved: 2026-05-25
- Rule: `@typescript-eslint/no-unused-vars`
- Symptom: `scheduled_for` was destructured from the event payload but never used inside the function body.
- Fix: removed the unused destructure entry. The schedule time is consumed at enqueue time via Inngest's `ts:` field, so the handler never needed it.
