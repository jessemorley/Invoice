"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"

const RANGE_DAYS = 30

function toISO(d: Date) {
  return d.toLocaleDateString("en-CA")
}

// Horizontally swipeable row of date cards. Native scroll-snap does the
// swiping; tapping a card selects it. Scrolling alone never selects —
// it only reports the centered date via onVisibleDateChange, e.g. for a
// month label that tracks the row as it scrolls.
export function DateCardPicker({
  value,
  onChange,
  onVisibleDateChange,
  className,
}: {
  value: string // YYYY-MM-DD
  onChange: (value: string) => void
  onVisibleDateChange?: (value: string) => void
  className?: string
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const throttleTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const behavior = useRef<ScrollBehavior>("instant")

  const [rangeCenter, setRangeCenter] = useState(value)
  const dates = useMemo(() => {
    const [y, m, d] = rangeCenter.split("-").map(Number)
    return Array.from(
      { length: RANGE_DAYS * 2 + 1 },
      (_, i) => new Date(y, m - 1, d - RANGE_DAYS + i)
    )
  }, [rangeCenter])

  // Re-anchor the range if value moves outside it (e.g. sheet reused for another entry)
  const inRange = toISO(dates[0]) <= value && value <= toISO(dates[dates.length - 1])
  if (!inRange && rangeCenter !== value) setRangeCenter(value)

  // Keep the selected card centered: instant on mount/external change, smooth on tap
  useEffect(() => {
    const scroller = scrollerRef.current
    const card = scroller?.querySelector<HTMLElement>(`[data-date="${value}"]`)
    if (!scroller || !card) return
    scroller.scrollTo({
      left: card.offsetLeft + card.offsetWidth / 2 - scroller.clientWidth / 2,
      behavior: behavior.current,
    })
    behavior.current = "instant"
  }, [value, dates])

  function centeredDate() {
    const scroller = scrollerRef.current
    if (!scroller) return undefined
    const center = scroller.scrollLeft + scroller.clientWidth / 2
    let closest: HTMLElement | undefined
    let closestDist = Infinity
    for (const child of scroller.children) {
      const el = child as HTMLElement
      const dist = Math.abs(el.offsetLeft + el.offsetWidth / 2 - center)
      if (dist < closestDist) {
        closestDist = dist
        closest = el
      }
    }
    return closest?.dataset.date
  }

  // Report the centered date live throughout the scroll (for a month label etc.);
  // throttled since scroll fires far more often than we need to re-render.
  function handleScroll() {
    if (throttleTimer.current) return
    throttleTimer.current = setTimeout(() => {
      throttleTimer.current = undefined
      const date = centeredDate()
      if (date) onVisibleDateChange?.(date)
    }, 50)
  }

  return (
    <div
      ref={scrollerRef}
      onScroll={handleScroll}
      className={cn(
        // px centers the first/last card: half container minus half card width (w-14)
        "flex gap-2 overflow-x-auto snap-x snap-mandatory px-[calc(50%-1.75rem)]",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {dates.map((d) => {
        const iso = toISO(d)
        const selected = iso === value
        return (
          <button
            key={iso}
            type="button"
            data-date={iso}
            aria-label={d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}
            aria-current={selected ? "date" : undefined}
            onClick={() => {
              behavior.current = "smooth"
              onChange(iso)
            }}
            className={cn(
              "snap-center flex w-14 shrink-0 flex-col items-center gap-0.5 rounded-xl border py-2",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input dark:bg-input/30"
            )}
          >
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wide",
                selected ? "text-primary-foreground/70" : "text-muted-foreground"
              )}
            >
              {d.toLocaleDateString("en-AU", { weekday: "short" })}
            </span>
            <span className="text-lg font-semibold">{d.getDate()}</span>
          </button>
        )
      })}
    </div>
  )
}
