function clientInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => /^[A-Z]/i.test(w))
    .map((w) => w[0].toUpperCase())
    .slice(0, 3)
    .join("");
}

import { cn } from "@/lib/utils";

export function ClientSquircle({ name, color, className }: { name: string; color: string; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center justify-center shrink-0 text-[10px] font-semibold size-7", className)}
      style={{ backgroundColor: `${color}33`, color, borderRadius: "30%", border: `1px solid ${color}55` }}
    >
      {clientInitials(name)}
    </span>
  );
}
