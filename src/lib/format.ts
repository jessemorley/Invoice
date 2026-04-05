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
