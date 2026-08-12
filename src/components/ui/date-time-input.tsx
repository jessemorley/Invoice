import { cn } from "@/lib/utils"

export function DateTimeInput({
  type,
  value,
  onChange,
  className,
  id,
}: {
  type: "date" | "time"
  value: string
  onChange: (value: string) => void
  className?: string
  id?: string
}) {
  return (
    <div className={cn("h-9 rounded-lg border border-input bg-transparent dark:bg-input/30 px-3 flex items-center", className)}>
      <input
        id={id}
        type={type}
        className="w-full bg-transparent outline-none text-sm text-foreground"
        // The browser reports "" on every keystroke until all segments are
        // filled — committing that would wipe the date as the user types.
        value={value}
        onChange={(e) => { if (e.target.value) onChange(e.target.value) }}
      />
    </div>
  )
}
