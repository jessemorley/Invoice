"use client"

import { cn } from "@/lib/utils"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

type Option<T extends string> = { value: T; label: string }

export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  className,
  itemClassName,
}: {
  value: T
  onValueChange: (value: T) => void
  options: Option<T>[]
  className?: string
  itemClassName?: string
}) {
  return (
    <ToggleGroup
      type="single"
      variant="segmented"
      value={value}
      onValueChange={(v) => v && onValueChange(v as T)}
      className={cn("w-full p-1 border border-input rounded-lg dark:bg-input/30", className)}
    >
      {options.map((opt) => (
        <ToggleGroupItem
          key={opt.value}
          value={opt.value}
          className={cn("flex-1 h-7", itemClassName)}
        >
          {opt.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
