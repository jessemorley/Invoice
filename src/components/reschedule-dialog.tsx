"use client";

import { useState, useTransition } from "react";
import { toLocalDateStr } from "@/lib/format";
import { rescheduleScheduledEmail } from "@/app/(app)/invoices/actions";
import { invalidate } from "@/lib/invalidate";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function formatPresetTime(d: Date): string {
  return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" }) +
    ", " +
    d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true });
}

function getNextMonday(from: Date): Date {
  const d = new Date(from);
  const day = d.getDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + daysUntilMonday);
  d.setHours(8, 0, 0, 0);
  return d;
}

function getPresets(): { label: string; date: Date }[] {
  const now = new Date();

  const thisAfternoon = new Date(now);
  thisAfternoon.setHours(17, 0, 0, 0);

  const tomorrowMorning = new Date(now);
  tomorrowMorning.setDate(now.getDate() + 1);
  tomorrowMorning.setHours(8, 0, 0, 0);

  const mondayMorning = getNextMonday(now);

  const presets: { label: string; date: Date }[] = [];
  if (thisAfternoon.getTime() > now.getTime()) {
    presets.push({ label: `This afternoon — ${formatPresetTime(thisAfternoon)}`, date: thisAfternoon });
  }
  presets.push({ label: `Tomorrow morning — ${formatPresetTime(tomorrowMorning)}`, date: tomorrowMorning });
  presets.push({ label: `Monday morning — ${formatPresetTime(mondayMorning)}`, date: mondayMorning });
  return presets;
}

interface RescheduleDialogProps {
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  scheduledEmailId: string | null;
  currentScheduledFor: string | null;
  onRescheduled?: (newScheduledFor: string) => void;
}

export function RescheduleDialog({ open, onOpenChangeAction, scheduledEmailId, currentScheduledFor, onRescheduled }: RescheduleDialogProps) {
  const [selected, setSelected] = useState<Date | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [presets] = useState(getPresets);

  function handleSave() {
    if (!scheduledEmailId || !selected) return;
    setError(null);
    startTransition(async () => {
      try {
        const iso = selected.toISOString();
        await rescheduleScheduledEmail(scheduledEmailId, iso, toLocalDateStr(selected));
        invalidate("invoices", "emails");
        onRescheduled?.(iso);
        onOpenChangeAction(false);
        setSelected(null);
        toast.success("Email rescheduled");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  const currentLabel = currentScheduledFor
    ? formatPresetTime(new Date(currentScheduledFor))
    : null;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChangeAction(o); if (!o) setSelected(null); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reschedule email</DialogTitle>
          {currentLabel && (
            <DialogDescription>Currently sending {currentLabel}</DialogDescription>
          )}
        </DialogHeader>
        <div className="flex flex-col gap-1">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className={cn(
                "text-left text-sm px-3 py-2 rounded-sm border border-transparent hover:bg-accent transition-colors",
                selected?.getTime() === preset.date.getTime() && "bg-accent border-border"
              )}
              onClick={() => setSelected(preset.date)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChangeAction(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending || !selected}>
            {isPending && <Spinner />}
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
