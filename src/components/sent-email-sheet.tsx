"use client";

import { useState } from "react";
import type { DashboardEmail } from "@/lib/types";
import { formatRelativeTime } from "@/lib/format";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Paperclip, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface SentEmailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: DashboardEmail | null;
}

export function SentEmailSheet({ open, onOpenChange, email }: SentEmailSheetProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  async function handleDownload() {
    if (!email) return;
    setIsDownloading(true);
    try {
      const res = await fetch(`/api/invoices/${email.invoice_id}/pdf`);
      const blob = await res.blob();
      const filename = email.filename ?? res.headers.get("Content-Disposition")?.match(/filename="(.+?)"/)?.[1] ?? "invoice.pdf";
      if (navigator.maxTouchPoints > 0 && navigator.canShare?.({ files: [new File([blob], filename, { type: "application/pdf" })] })) {
        await navigator.share({ files: [new File([blob], filename, { type: "application/pdf" })] }).catch((e) => {
          if (e?.name !== "AbortError") throw e;
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="sr-only" showCloseButton={false}>
          <SheetTitle>Sent Email — Invoice {email?.invoice_number}</SheetTitle>
        </SheetHeader>

        {email && (
          <>
            {/* Header */}
            <div className="px-6 py-5 border-b flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">Sent Email — Invoice {email.invoice_number}</h2>
                {email.sent_at && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {formatRelativeTime(email.sent_at)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-ring mt-0.5 shrink-0"
              >
                <X className="size-4" />
                <span className="sr-only">Close</span>
              </button>
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
                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors w-fit disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDownloading ? <Spinner data-icon="inline-start" className="size-3 shrink-0" /> : <Paperclip className="size-3 shrink-0" />}
                  <span className="truncate max-w-56">{isDownloading ? "Generating…" : email.filename}</span>
                </button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
