import { describe, it, expect } from "vitest";
import { weeklyCutoff } from "./format";

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
