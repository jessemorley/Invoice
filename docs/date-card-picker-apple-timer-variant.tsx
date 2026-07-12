// Saved variant, not wired into the app. Apple-timer-picker style date
// picker for src/components/ui/date-card-picker.tsx: cards never change
// color, a static center pill overlay marks the selection instead. Full
// history/rationale in docs/handoff/date-picker-haptic-feedback.md and
// commit c159f2d. Superseded by the tap-only + onVisibleDateChange design
// (commit 16af8d3) as the shipped version — restore this file's contents
// over date-card-picker.tsx if the pill style is wanted again.

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"

const RANGE_DAYS = 30
const CARD_WIDTH = 56 // w-14
const CARD_GAP = 8 // gap-2
const ITEM_STEP = CARD_WIDTH + CARD_GAP

function toISO(d: Date) {
  return d.toLocaleDateString("en-CA")
}

// Horizontally swipeable row of date cards, Apple-timer-picker style: the
// cards themselves never change color. A single static pill sits fixed in
// the center of the viewport as a pure visual overlay — whatever card is
// physically inside it reads as "selected" simply because the pill is
// drawn in front, not because any card's classes changed. That's what
// makes it lag-free at any swipe speed: nothing has to compute or paint
// per-card state on scroll, the pill never moves or updates.
export function DateCardPicker({
  value,
  onChange,
  className,
}: {
  value: string // YYYY-MM-DD
  onChange: (value: string) => void
  className?: string
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const lastIndex = useRef<number | null>(null)
  // set when the change came from swiping, so we don't scroll under the user's finger
  const fromScroll = useRef(false)
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

  const valueIndex = dates.findIndex((d) => toISO(d) === value)

  // Keep the selected card centered: instant on mount/external change, smooth on tap
  useEffect(() => {
    if (fromScroll.current) {
      fromScroll.current = false
      return
    }
    const scroller = scrollerRef.current
    if (!scroller || valueIndex < 0) return
    scroller.scrollTo({ left: valueIndex * ITEM_STEP, behavior: behavior.current })
    behavior.current = "instant"
    lastIndex.current = valueIndex
  }, [valueIndex, dates])

  // Commit the centered date as soon as it changes — no debounce, since
  // nothing destructive happens on selection here (the entry sheet has its
  // own Save/Cancel), so there's no reason to wait for scrolling to settle.
  function handleScroll() {
    const scroller = scrollerRef.current
    if (!scroller) return
    const index = Math.max(0, Math.min(dates.length - 1, Math.round(scroller.scrollLeft / ITEM_STEP)))
    if (index === lastIndex.current) return
    lastIndex.current = index
    const date = toISO(dates[index])
    if (date !== value) {
      fromScroll.current = true
      onChange(date)
    }
  }

  return (
    <div className="relative">
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
          return (
            <button
              key={iso}
              type="button"
              aria-label={d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}
              aria-current={iso === value ? "date" : undefined}
              onClick={() => {
                behavior.current = "smooth"
                onChange(iso)
              }}
              className="snap-center flex w-14 shrink-0 flex-col items-center gap-0.5 rounded-xl border border-input py-2 dark:bg-input/30"
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {d.toLocaleDateString("en-AU", { weekday: "short" })}
              </span>
              <span className="text-lg font-semibold">{d.getDate()}</span>
            </button>
          )
        })}
      </div>
      {/* Static selection pill, fixed in the center — never moves, never repaints.
          Whatever card sits inside it reads as selected purely because it's drawn
          in front, like the band on Apple's timer picker. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-1/2 w-14 -translate-x-1/2 rounded-xl border-2 border-primary"
      />
    </div>
  )
}
