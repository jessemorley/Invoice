import { cn } from "@/lib/utils"

export function DateTimeInput({
  type,
  value,
  onChange,
  className,
}: {
  type: "date" | "time"
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <div className={cn("h-9 rounded-lg border border-input bg-transparent dark:bg-input/30 px-3 flex items-center", className)}>
      <input
        type={type}
        className="w-full bg-transparent outline-none text-sm text-foreground"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
