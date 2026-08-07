/**
 * The bcc_self preference and a user-typed BCC both need to land, so merge them
 * (deduped, case-insensitively) rather than letting one win.
 */
export function mergeBcc(typed: string | undefined, selfAddress: string | null): string | null {
  const all = [...(typed ?? "").split(","), selfAddress ?? ""]
    .map((e) => e.trim())
    .filter(Boolean);
  const deduped = [...new Set(all.map((e) => e.toLowerCase()))];
  return deduped.length > 0 ? deduped.join(", ") : null;
}

/**
 * Inverse of mergeBcc: drops the auto-added self-BCC so the compose form shows
 * only what the user actually typed. Without this the bcc_self preference shows
 * up as a chip the user never added, and deleting it silently disables the
 * preference for that email.
 */
export function stripSelfBcc(stored: string | null, selfAddress: string | null): string[] {
  const self = selfAddress?.trim().toLowerCase();
  return (stored ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean)
    .filter((e) => !self || e.toLowerCase() !== self);
}
