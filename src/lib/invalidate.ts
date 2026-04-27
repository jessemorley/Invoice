/**
 * Client-side data invalidation for the SPA view-switch architecture.
 *
 * Server actions cannot call window.dispatchEvent (server-side only).
 * Instead, client components call `invalidate()` after awaiting a mutation
 * action. ViewSwitch listens for the event and re-fetches affected views.
 *
 * Usage — in any client component, after a mutation:
 *   await createEntry(data);
 *   invalidate("entries");
 *
 * Adding a new view: add the tag to the union type, handle it in ViewSwitch's
 * "data:invalidate" event listener, and call invalidate() at every call site
 * that mutates that data.
 */

export type InvalidationTag =
  | "entries"
  | "invoices"
  | "clients"
  | "expenses"
  | "settings";

export function invalidate(...tags: InvalidationTag[]) {
  for (const tag of tags) {
    window.dispatchEvent(new CustomEvent("data:invalidate", { detail: tag }));
  }
}
