# Pre-existing issues

Running log of lint/type/build warnings that exist on `main` but are unrelated to whatever change is in flight. Recorded so they're not silently re-encountered and so we know what's safe to ignore vs. fix.

When you hit one of these during a task, do **not** fix it inline — that bloats the diff and muddies review. Either:

1. Add it here (with date + context) if it's new, or
2. Leave it alone if it's already listed, or
3. Open a dedicated branch/PR if you actually want to address it.

## Open

### test failures: floating-dock.test.tsx expects pre-redesign dock behavior (4 tests)

- First noted: 2026-07-19 (during feature/emails-view)
- Symptom: `npm test` fails 4 tests on clean `main` — "Plus is disabled when view is clients" (Plus is now enabled for clients via `DOCK_NEW_VIEWS`), and three overflow-menu tests that expect a "Dashboard" button inside the popover (Dashboard is now a primary tab, not a menu item). Tests describe an older dock layout.
- Likely fix: update the test's `PRIMARY_TABS`/`SECONDARY_TABS`/`DOCK_NEW_VIEWS` expectations to match the current dock.

### test suite broken: src/lib/tax-estimate.test.ts — "No test suite found in file"

- First noted: 2026-07-19 (during feature/emails-view)
- Symptom: vitest reports the file contains no test suite; the whole file fails to load/collect.

## Resolved

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
