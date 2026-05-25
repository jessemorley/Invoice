"use client";

import { useEffect, useState } from "react";
import type { DashboardEmail } from "@/lib/types";
import { getSentEmailPdfUrl } from "@/app/(app)/invoices/actions";
import { formatRelativeTime } from "@/lib/format";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Paperclip, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";

interface SentEmailSheetProps {
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  email: DashboardEmail | null;
}

export function SentEmailSheet({ open, onOpenChangeAction, email }: SentEmailSheetProps) {
  const [isOpening, setIsOpening] = useState(false);
  const [archiveLost, setArchiveLost] = useState(false);

  useEffect(() => {
    setArchiveLost(false);
  }, [email?.id]);

  const archivePresent = Boolean(email?.sent_pdf_path) && !archiveLost;

  async function handleOpenArchive() {
    if (!email || !email.sent_pdf_path) return;
    setIsOpening(true);
    try {
      const signedUrl = await getSentEmailPdfUrl(email.id);
      if (!signedUrl) {
        toast.warning("Archived copy is no longer available");
        setArchiveLost(true);
        return;
      }

      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } finally {
      setIsOpening(false);
    }
  }

  function handleOpenCurrent() {
    if (!email) return;
    window.open(`/api/invoices/${email.invoice_id}/pdf`, "_blank", "noopener,noreferrer");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChangeAction}>
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
                onClick={() => onOpenChangeAction(false)}
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

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Attachment</span>
                {archivePresent ? (
                  <button
                    onClick={handleOpenArchive}
                    disabled={isOpening}
                    className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors w-fit disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isOpening ? <Spinner data-icon="inline-start" className="size-3 shrink-0" /> : <Paperclip className="size-3 shrink-0" />}
                    <span className="truncate max-w-56">{isOpening ? "Opening…" : email.filename}</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-2.5 py-1.5 text-xs text-muted-foreground/70 w-fit cursor-not-allowed"
                    >
                      <Paperclip className="size-3 shrink-0" />
                      <span className="truncate max-w-56">Archived copy unavailable</span>
                    </button>
                    <p className="text-xs text-muted-foreground/70">
                      No archived copy of the sent PDF is stored for this email.{" "}
                      <button
                        type="button"
                        onClick={handleOpenCurrent}
                        className="underline underline-offset-2 hover:text-foreground transition-colors"
                      >
                        View current invoice PDF
                      </button>
                    </p>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
