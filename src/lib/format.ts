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

export function isoWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const dayOfWeek = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dayOfWeek);
  const year = d.getFullYear();
  const yearStart = new Date(year, 0, 1);
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${year}-W${String(weekNo).padStart(2, "0")}`;
}
