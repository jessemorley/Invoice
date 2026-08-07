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
