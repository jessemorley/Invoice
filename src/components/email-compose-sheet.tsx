"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import type { InvoiceDetail } from "@/lib/types";
import { formatAUD, formatDateShort } from "@/lib/format";
import { scheduleInvoiceEmail, cancelScheduledEmail } from "@/app/(app)/invoices/actions";
import type { EmailFormData } from "@/app/(app)/invoices/actions";
import { invalidate } from "@/lib/invalidate";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group";
import { Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

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

function getPresets(): { label: string; date: Date | null }[] {
  const now = new Date();

  const thisAfternoon = new Date(now);
  thisAfternoon.setHours(17, 0, 0, 0);

  const tomorrowMorning = new Date(now);
  tomorrowMorning.setDate(now.getDate() + 1);
  tomorrowMorning.setHours(8, 0, 0, 0);

  const mondayMorning = getNextMonday(now);

  return [
    { label: "Now", date: null },
    { label: `This afternoon — ${formatPresetTime(thisAfternoon)}`, date: thisAfternoon },
    { label: `Tomorrow morning — ${formatPresetTime(tomorrowMorning)}`, date: tomorrowMorning },
    { label: `Monday morning — ${formatPresetTime(mondayMorning)}`, date: mondayMorning },
  ];
}

function defaultBody(invoice: InvoiceDetail, businessName: string): string {
  const greeting = invoice.client.contact_name ?? invoice.client.name;
  const duePart = invoice.due_date ? ` due ${formatDateShort(invoice.due_date)}` : "";
  return `Hi ${greeting},\n\nPlease find attached invoice ${invoice.number} for ${formatAUD(invoice.total)}${duePart}.\n\nThanks,\n${businessName}`;
}

interface EmailChipInputProps {
  chips: string[];
  input: string;
  onChipsChange: (chips: string[]) => void;
  onInputChange: (val: string) => void;
  onConfirmInput: () => void;
}

function EmailChipInput({ chips, input, onChipsChange, onInputChange, onConfirmInput }: EmailChipInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function removeChip(i: number) {
    onChipsChange(chips.filter((_, idx) => idx !== i));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "," || e.key === "Enter") {
      e.preventDefault();
      onConfirmInput();
    } else if (e.key === "Backspace" && input === "" && chips.length > 0) {
      onChipsChange(chips.slice(0, -1));
    }
  }

  return (
    <div
      className="flex flex-wrap gap-1.5 min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm cursor-text focus-within:ring-1 focus-within:ring-ring"
      onClick={() => inputRef.current?.focus()}
    >
      {chips.map((chip, i) => (
        <span
          key={i}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            isValidEmail(chip)
              ? "bg-secondary text-secondary-foreground"
              : "bg-destructive/10 text-destructive border border-destructive/40"
          )}
        >
          {chip}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); removeChip(i); }}
            className="opacity-60 hover:opacity-100"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={onConfirmInput}
        placeholder={chips.length === 0 ? "recipient@example.com" : ""}
        className="flex-1 min-w-32 bg-transparent outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

function toastDescription(date: Date | null): string {
  if (!date) return "Sending now";
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  const time = date.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
  if (isToday) return `Today at ${time}`;
  if (isTomorrow) return `Tomorrow at ${time}`;
  const dayName = date.toLocaleDateString("en-AU", { weekday: "long" });
  return `${dayName} at ${time}`;
}

interface ComposeContentProps {
  invoice: InvoiceDetail;
  businessName: string;
  onClose: () => void;
  onSent: () => void;
}

function ComposeContent({ invoice, businessName, onClose, onSent }: ComposeContentProps) {
  const [chips, setChips] = useState<string[]>(() =>
    invoice.client.email ? [invoice.client.email] : []
  );
  const [chipInput, setChipInput] = useState("");
  const [subject, setSubject] = useState(`Invoice ${invoice.number}`);
  const [body, setBody] = useState(() => defaultBody(invoice, businessName));
  const [scheduledFor, setScheduledFor] = useState<Date | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const confirmChipInput = useCallback(() => {
    const val = chipInput.trim().replace(/,$/, "").trim();
    if (val) {
      setChips((prev) => [...prev, val]);
      setChipInput("");
    }
  }, [chipInput]);

  const validChips = chips.filter(isValidEmail);
  const hasValidRecipient = validChips.length > 0 || (chipInput.trim() && isValidEmail(chipInput.trim()));

  function handleSubmit() {
    const allChips = [...chips];
    const pendingVal = chipInput.trim().replace(/,$/, "").trim();
    if (pendingVal) allChips.push(pendingVal);

    const validRecipients = allChips.filter(isValidEmail);
    if (validRecipients.length === 0) return;

    setError(null);
    startTransition(async () => {
      try {
        const data: EmailFormData = {
          to: validRecipients.join(", "),
          subject,
          body_text: body,
          scheduled_for: scheduledFor?.toISOString() ?? new Date().toISOString(),
        };
        const result = await scheduleInvoiceEmail(invoice.id, data);
        invalidate("invoices");
        onSent();
        onClose();
        toast(`Email scheduled for ${toastDescription(scheduledFor)}`, {
          action: {
            label: "Undo",
            onClick: async () => {
              if (result?.id) {
                await cancelScheduledEmail(result.id);
                invalidate("invoices");
              }
            },
          },
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  const presets = getPresets();

  return (
    <>
      {/* Header */}
      <div className="px-6 py-5 border-b">
        <h2 className="text-base font-semibold">Send Invoice {invoice.number}</h2>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">To</label>
          <EmailChipInput
            chips={chips}
            input={chipInput}
            onChipsChange={setChips}
            onInputChange={setChipInput}
            onConfirmInput={confirmChipInput}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Subject</label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>

        <div className="flex flex-col gap-2 flex-1">
          <label className="text-sm font-medium">Message</label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="flex-1 resize-none min-h-40"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t flex flex-col gap-2">
        {scheduledFor && (
          <p className="text-xs text-muted-foreground text-center">
            Scheduled for {formatPresetTime(scheduledFor)}
          </p>
        )}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <ButtonGroup className="flex-1">
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  size="icon"
                  className={cn(scheduledFor && "text-primary-foreground/60")}
                  disabled={isPending}
                >
                  <Clock className="size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" side="top" className="w-auto p-1">
                <div className="flex flex-col">
                  {presets.map((preset) => (
                    <button
                      key={preset.label}
                      className={cn(
                        "text-left text-sm px-3 py-2 rounded-sm hover:bg-accent transition-colors",
                        scheduledFor?.getTime() === preset.date?.getTime() && "bg-accent"
                      )}
                      onClick={() => {
                        setScheduledFor(preset.date);
                        setPopoverOpen(false);
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <ButtonGroupSeparator />
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={isPending || !hasValidRecipient}
            >
              {isPending ? "Sending…" : "Send"}
            </Button>
          </ButtonGroup>
        </div>
      </div>
    </>
  );
}

interface EmailComposeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: InvoiceDetail | null;
  businessName: string;
  onSent: () => void;
}

export function EmailComposeSheet({ open, onOpenChange, invoice, businessName, onSent }: EmailComposeSheetProps) {
  if (!invoice) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Send Invoice {invoice.number}</SheetTitle>
        </SheetHeader>
        <ComposeContent
          invoice={invoice}
          businessName={businessName}
          onClose={() => onOpenChange(false)}
          onSent={onSent}
        />
      </SheetContent>
    </Sheet>
  );
}
