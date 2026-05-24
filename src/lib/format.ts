export function toLocalDateStr(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function formatAUD(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const dow = d.toLocaleDateString("en-AU", { weekday: "short" });
  const day = d.getDate();
  const month = d.toLocaleDateString("en-AU", { month: "short" });
  return `${dow} ${day} ${month}`;
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDate();
  const month = d.toLocaleDateString("en-AU", { month: "short" });
  return `${day} ${month}`;
}

export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = date.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
  if (date.toDateString() === now.toDateString()) return `Today at ${time}`;
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow at ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday at ${time}`;
  const dayName = date.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short" });
  return `${dayName} at ${time}`;
}

export function isoWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const dayOfWeek = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dayOfWeek);
  const year = d.getFullYear();
  const yearStart = new Date(year, 0, 1);
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${year}-W${String(weekNo).padStart(2, "0")}`;
}

// Returns the UTC instant corresponding to a Sydney wall-clock cutoff within a given ISO week.
// type "friday_5pm" → Friday 17:00 AEST/AEDT; "sunday_midnight" → Monday 00:00 AEST/AEDT
// (i.e. the very end of Sunday night). Handles AEST↔AEDT automatically via Intl.
export function weeklyCutoff(isoWeek: string, type: "friday_5pm" | "sunday_midnight"): Date {
  const [yearStr, weekStr] = isoWeek.split("-W");
  const jan4 = new Date(Date.UTC(parseInt(yearStr, 10), 0, 4));
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
  // Offset from Monday: Friday = +4 days at 17:00, Sunday midnight = +7 days at 00:00
  const [dayOffset, hour] = type === "friday_5pm" ? [4, 17] : [7, 0];
  const target = new Date(week1Monday);
  target.setUTCDate(week1Monday.getUTCDate() + (parseInt(weekStr, 10) - 1) * 7 + dayOffset);
  // Probe: treat the target wall-clock date/hour as fake UTC, format in Sydney to read the offset,
  // then add diffMs (negative for east-of-UTC zones) to shift back to real UTC.
  const localStr = `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(target.getUTCDate()).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00`;
  const fmt = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const probe = new Date(localStr + "Z");
  const p = Object.fromEntries(fmt.formatToParts(probe).map((x) => [x.type, x.value]));
  const diffMs = probe.getTime() - new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`).getTime();
  return new Date(probe.getTime() + diffMs);
}
