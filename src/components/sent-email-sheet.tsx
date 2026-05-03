"use client";

import type { DashboardEmail } from "@/lib/types";
import { formatRelativeTime } from "@/lib/format";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Paperclip } from "lucide-react";

interface SentEmailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: DashboardEmail | null;
}

export function SentEmailSheet({ open, onOpenChange, email }: SentEmailSheetProps) {
  if (!email) return null;

  const pdfUrl = `/api/invoices/${email.invoice_id}/pdf`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Sent Email — Invoice {email.invoice_number}</SheetTitle>
        </SheetHeader>

        {/* Header */}
        <div className="px-6 py-5 border-b">
          <h2 className="text-base font-semibold">Sent Email — Invoice {email.invoice_number}</h2>
          {email.sent_at && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {formatRelativeTime(email.sent_at)}
            </p>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">To</span>
            <span className="text-sm">{email.to_address}</span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Subject</span>
            <span className="text-sm">{email.subject}</span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Message</span>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{email.body_text}</p>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Attachment</span>
            <a
              href={pdfUrl}
              download={email.filename}
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors w-fit"
            >
              <Paperclip className="size-3 shrink-0" />
              <span className="truncate max-w-56">{email.filename}</span>
            </a>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
