import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const tableHeadCellBase =
  "h-9 px-6 bg-transparent dark:bg-input/30 border-y border-input text-xs text-muted-foreground font-medium";

interface SortableTableHeadProps {
  children: React.ReactNode;
  active: boolean;
  dir: "asc" | "desc";
  onSort: () => void;
  align?: "left" | "right";
  className?: string;
}

export function SortableTableHead({
  children,
  active,
  dir,
  onSort,
  align = "left",
  className,
}: SortableTableHeadProps) {
  const Icon = active ? (dir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <TableHead
      className={cn("cursor-pointer select-none", className)}
      onClick={onSort}
    >
      <div className={cn("flex items-center gap-1", align === "right" && "justify-end")}>
        {align === "right" && (
          <Icon className={cn("size-3.5 shrink-0", !active && "text-muted-foreground/40")} />
        )}
        {children}
        {align === "left" && (
          <Icon className={cn("size-3.5 shrink-0", !active && "text-muted-foreground/40")} />
        )}
      </div>
    </TableHead>
  );
}
