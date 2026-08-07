import { describe, it, expect } from "vitest";
import { mergeBcc, stripSelfBcc } from "@/lib/merge-bcc";

describe("mergeBcc", () => {
  it("returns null when there is nothing to BCC", () => {
    expect(mergeBcc(undefined, null)).toBeNull();
    expect(mergeBcc("", null)).toBeNull();
    expect(mergeBcc("  ,  ", null)).toBeNull();
  });

  it("keeps the self-BCC when the user typed none", () => {
    expect(mergeBcc(undefined, "me@example.com")).toBe("me@example.com");
  });

  it("keeps typed addresses when the self-BCC pref is off", () => {
    expect(mergeBcc("a@example.com, b@example.com", null)).toBe("a@example.com, b@example.com");
  });

  it("merges typed addresses with the self-BCC", () => {
    expect(mergeBcc("a@example.com", "me@example.com")).toBe("a@example.com, me@example.com");
  });

  it("does not add the self-BCC twice when the user already typed it", () => {
    expect(mergeBcc("me@example.com", "me@example.com")).toBe("me@example.com");
    expect(mergeBcc("ME@Example.com", "me@example.com")).toBe("me@example.com");
  });
});

describe("stripSelfBcc", () => {
  it("returns an empty list when there is nothing stored", () => {
    expect(stripSelfBcc(null, "me@example.com")).toEqual([]);
    expect(stripSelfBcc("", "me@example.com")).toEqual([]);
  });

  it("removes the self-BCC, case-insensitively", () => {
    expect(stripSelfBcc("me@example.com", "me@example.com")).toEqual([]);
    expect(stripSelfBcc("ME@Example.com", "me@example.com")).toEqual([]);
    expect(stripSelfBcc("a@example.com, me@example.com", "me@example.com")).toEqual(["a@example.com"]);
  });

  it("keeps everything when the bcc_self pref is off", () => {
    expect(stripSelfBcc("a@example.com, me@example.com", null)).toEqual([
      "a@example.com",
      "me@example.com",
    ]);
  });

  it("round-trips with mergeBcc so editing does not drop or duplicate the self-BCC", () => {
    const self = "me@example.com";
    const stored = mergeBcc("a@example.com", self); // what the send path wrote
    const shown = stripSelfBcc(stored, self); // what the edit form displays
    expect(shown).toEqual(["a@example.com"]);
    expect(mergeBcc(shown.join(", "), self)).toBe(stored); // what the save path writes back
  });
});
