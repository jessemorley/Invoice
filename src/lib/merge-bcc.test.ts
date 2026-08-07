import { describe, it, expect } from "vitest";
import { mergeBcc } from "@/lib/merge-bcc";

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
