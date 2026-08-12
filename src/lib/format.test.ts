import { describe, it, expect } from "vitest";
import { weeklyCutoff, wfhFixedRate, fyWeekdaysWithoutEntries } from "./format";

// ISO week 2026-W21: Mon 18 May – Sun 24 May 2026 (AEST, UTC+10)
// ISO week 2026-W03: Mon 12 Jan – Sun 18 Jan 2026 (AEDT, UTC+11)

describe("weeklyCutoff — AEST (UTC+10, winter)", () => {
  it("friday_5pm returns 2026-05-22 07:00 UTC (5pm AEST)", () => {
    const result = weeklyCutoff("2026-W21", "friday_5pm");
    expect(result.toISOString()).toBe("2026-05-22T07:00:00.000Z");
  });

  it("sunday_midnight returns 2026-05-24 14:00 UTC (Mon 00:00 AEST)", () => {
    const result = weeklyCutoff("2026-W21", "sunday_midnight");
    expect(result.toISOString()).toBe("2026-05-24T14:00:00.000Z");
  });
});

describe("weeklyCutoff — AEDT (UTC+11, summer)", () => {
  it("friday_5pm returns 2026-01-16 06:00 UTC (5pm AEDT)", () => {
    const result = weeklyCutoff("2026-W03", "friday_5pm");
    expect(result.toISOString()).toBe("2026-01-16T06:00:00.000Z");
  });

  it("sunday_midnight returns 2026-01-18 13:00 UTC (Mon 00:00 AEDT)", () => {
    const result = weeklyCutoff("2026-W03", "sunday_midnight");
    expect(result.toISOString()).toBe("2026-01-18T13:00:00.000Z");
  });
});

describe("wfhFixedRate — ATO PCG 2023/1", () => {
  it("uses 70c from FY25 (2024-25) onward", () => {
    expect(wfhFixedRate(2024)).toBe(0.7);
    expect(wfhFixedRate(2025)).toBe(0.7);
  });

  it("uses 67c for FY23 and FY24", () => {
    expect(wfhFixedRate(2022)).toBe(0.67);
    expect(wfhFixedRate(2023)).toBe(0.67);
  });

  it("has no fixed rate before FY23", () => {
    expect(wfhFixedRate(2021)).toBeNull();
  });
});

describe("fyWeekdaysWithoutEntries", () => {
  // FY26 starts Tue 2025-07-01; 2025-07-07 is the following Monday → 5 weekdays elapsed.
  it("counts weekdays from FY start through today", () => {
    expect(fyWeekdaysWithoutEntries(2025, new Set(), "2025-07-07")).toBe(5);
  });

  it("subtracts weekday entries but ignores weekend entries", () => {
    const entries = new Set(["2025-07-02", "2025-07-05"]); // Wed + Sat
    expect(fyWeekdaysWithoutEntries(2025, entries, "2025-07-07")).toBe(4);
  });

  it("caps at FY end (FY26 = 261 weekdays)", () => {
    expect(fyWeekdaysWithoutEntries(2025, new Set(), "2026-12-31")).toBe(261);
  });

  it("returns 0 before the FY starts", () => {
    expect(fyWeekdaysWithoutEntries(2025, new Set(), "2025-06-30")).toBe(0);
  });
});
