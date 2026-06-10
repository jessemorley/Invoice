# Pre-existing issues

Running log of lint/type/build warnings that exist on `main` but are unrelated to whatever change is in flight. Recorded so they're not silently re-encountered and so we know what's safe to ignore vs. fix.

When you hit one of these during a task, do **not** fix it inline — that bloats the diff and muddies review. Either:

1. Add it here (with date + context) if it's new, or
2. Leave it alone if it's already listed, or
3. Open a dedicated branch/PR if you actually want to address it.

## Open

### lint: `setState` synchronously inside effect — [src/components/floating-dock.tsx:41](src/components/floating-dock.tsx#L41)

- First noted: 2026-05-25
- Rule: `react-hooks/set-state-in-effect`
- Symptom: `setPillVisible(false)` called inside an effect body — flagged as causing cascading renders.
- Risk: low. The effect runs on `view` change and the early-return branch is rare; performance impact is negligible. Fix would refactor the pill-position logic to derive visibility from state instead of an effect.

### lint: `setState` synchronously inside effect — [src/components/client-sheet.tsx:834](src/components/client-sheet.tsx#L834)

- First noted: 2026-06-10
- Rule: `react-hooks/set-state-in-effect`
- Symptom: `setRates(null)` called synchronously in the early-return branch of a `useEffect` guarded by `!open`.
- Risk: low. Runs only when the sheet closes; the cascade is a single render.

### lint: `setState` synchronously inside effect — [src/components/workflow-rates-section.tsx:122](src/components/workflow-rates-section.tsx#L122)

- First noted: 2026-06-10
- Rule: `react-hooks/set-state-in-effect`
- Symptom: `setForm(rateToForm(savedData))` called synchronously inside an effect that syncs form state from a saved record after a save roundtrip.
- Risk: low. Only triggers when `savedData` changes externally; single extra render.

### lint warning: unused `sendPushToUser` export — [src/app/(app)/settings/actions.ts:7](src/app/(app)/settings/actions.ts#L7)

- First noted: 2026-06-10
- Rule: `@typescript-eslint/no-unused-vars`
- Symptom: `sendPushToUser` is exported from settings actions but not imported anywhere — likely exported for future use or direct invocation via server action.
- Risk: none. Dead export only.

### lint warning: unused `Label` import — [src/components/client-sheet.tsx:29](src/components/client-sheet.tsx#L29)

- First noted: 2026-06-10
- Rule: `@typescript-eslint/no-unused-vars`
- Symptom: `Label` is imported but not referenced anywhere in the file.
- Risk: none. Dead import only.

## Resolved

### lint warning: unused `scheduled_for` in Inngest send handler — src/inngest/send-invoice-email.ts

- First noted: 2026-05-25
- Resolved: 2026-05-25
- Rule: `@typescript-eslint/no-unused-vars`
- Symptom: `scheduled_for` was destructured from the event payload but never used inside the function body.
- Fix: removed the unused destructure entry. The schedule time is consumed at enqueue time via Inngest's `ts:` field, so the handler never needed it.
