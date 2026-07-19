"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { ComposePrefill, DashboardEmail, InvoiceDetail } from "@/lib/types";
import { loadScheduledEmail, deleteEmails } from "@/app/(app)/invoices/actions";
import { invalidate } from "@/lib/invalidate";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientSquircle } from "@/components/client-squircle";
import { EmailComposeSheet } from "@/components/email-compose-sheet";
import { SentEmailSheet } from "@/components/sent-email-sheet";
import { Paperclip, Pencil, Trash2 } from "lucide-react";

function emailDate(email: DashboardEmail): string {
  // Bounced rows keep their sent_at — show when the email actually went out.
  const d = new Date(email.sent_at ?? email.scheduled_for);
  return `${d.toLocaleDateString("en-AU", { month: "short" })} ${d.getDate()}`;
}

function scheduledLabel(email: DashboardEmail): string {
  const d = new Date(email.scheduled_for);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const day =
    d.toDateString() === now.toDateString() ? "today"
    : d.toDateString() === tomorrow.toDateString() ? "tomorrow"
    : d.toLocaleDateString("en-AU", { weekday: "long" });
  const time = d.toLocaleTimeString("en-AU", {
    hour: "numeric",
    ...(d.getMinutes() ? { minute: "2-digit" } : {}),
    hour12: true,
  }).toLowerCase();
  return `Scheduled for ${day} ${time}`;
}

function SkeletonTableRows({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <TableRow key={i}>
          <TableCell className="py-3 pl-4 pr-0 w-10"><Skeleton className="size-4" /></TableCell>
          <TableCell className="py-3 px-6 w-72">
            <div className="flex items-center gap-3">
              <Skeleton className="size-6 rounded-md" />
              <Skeleton className="h-4 w-24" />
            </div>
          </TableCell>
          <TableCell className="py-3 px-6"><Skeleton className="h-4 w-72 max-w-full" /></TableCell>
          <TableCell className="py-3 px-2 w-8"><Skeleton className="size-3.5 ml-auto" /></TableCell>
          <TableCell className="py-3 pl-2 pr-6 w-24"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

// Mail-style swipe-left row: drag past a quarter of the row width and the
// card accelerates off-screen, the row collapses, and onDelete fires
// (parent shows an undo toast). Short of that it snaps back closed.
// Axis-locked so vertical list scrolling never fights the swipe.
function SwipeableRow({
  onDelete,
  onClick,
  children,
}: {
  onDelete: () => void;
  onClick: () => void;
  children: React.ReactNode;
}) {
  // Drag position lives in refs and is written straight to the DOM node —
  // per-frame React renders and layout-triggering styles are what kill 60Hz.
  const [pastThreshold, setPastThreshold] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<"h" | "v" | null>(null);
  const dxRef = useRef(0);
  const firedRef = useRef(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  function moveCard(dx: number, mode: "drag" | "settle" | "exit") {
    const el = cardRef.current;
    if (!el) return;
    el.style.transition =
      mode === "drag" ? "none"
      // Accelerating exit — slight ease at the start, then away.
      : mode === "exit" ? "transform 115ms cubic-bezier(0.55, 0.085, 0.68, 0.53)"
      : "";
    el.style.transform = `translateX(${dx}px)`;
    dxRef.current = dx;
  }

  // Card is gone: collapse the vacated space, then hand over to the parent.
  function exitThenCollapse() {
    const wrapper = rowRef.current;
    window.setTimeout(() => {
      if (!wrapper) {
        onDelete();
        return;
      }
      wrapper.style.height = `${wrapper.offsetHeight}px`;
      void wrapper.offsetHeight; // flush so the height transition has a start value
      wrapper.style.transition = "height 135ms ease-out";
      wrapper.style.height = "0px";
      window.setTimeout(onDelete, 145);
    }, 120);
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (firedRef.current) return;
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
    axis.current = null;
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!start.current) return;
    const t = e.touches[0];
    const moveX = t.clientX - start.current.x;
    const moveY = t.clientY - start.current.y;
    if (!axis.current) {
      if (Math.abs(moveX) < 8 && Math.abs(moveY) < 8) return;
      axis.current = Math.abs(moveX) > Math.abs(moveY) ? "h" : "v";
    }
    if (axis.current === "v") return;
    const width = rowRef.current?.clientWidth ?? 360;
    const next = Math.min(0, Math.max(-width, moveX));
    moveCard(next, "drag");
    // Bails out of re-rendering except on the crossing itself.
    setPastThreshold(next < -width / 4);
  }

  function handleTouchEnd() {
    if (firedRef.current) return;
    if (axis.current === "h") {
      const width = rowRef.current?.clientWidth ?? 360;
      if (dxRef.current < -width / 4) {
        firedRef.current = true;
        moveCard(-width, "exit");
        exitThenCollapse();
      } else {
        moveCard(0, "settle");
      }
    }
    setPastThreshold(false);
    start.current = null;
  }

  function handleClick() {
    // A horizontal drag ends with a click event — swallow it.
    if (axis.current === "h") {
      axis.current = null;
      return;
    }
    onClick();
  }

  return (
    <div ref={rowRef} className="relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 flex items-center justify-end bg-destructive pr-7 text-white"
      >
        <Trash2
          className={cn(
            "size-5 transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
            pastThreshold ? "scale-125" : "scale-75"
          )}
        />
      </div>
      <div
        ref={cardRef}
        className="relative bg-background touch-pan-y transition-transform duration-200 ease-out"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
      >
        {children}
      </div>
    </div>
  );
}

function SkeletonMobileRows({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3.5">
          <Skeleton className="size-8 rounded-lg shrink-0" />
          <div className="flex-1 flex flex-col gap-1.5 min-w-0">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-56 max-w-full" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      ))}
    </>
  );
}

function EmailsTable({
  title,
  emails,
  onRowClick,
  loading,
  emptyLabel,
  showStatus,
  selected,
  onToggle,
  pendingDeleteIds,
  onSwipeDelete,
}: {
  title: string;
  emails: DashboardEmail[];
  onRowClick: (email: DashboardEmail) => void;
  loading?: boolean;
  emptyLabel?: string;
  showStatus?: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  pendingDeleteIds: Set<string>;
  onSwipeDelete: (email: DashboardEmail) => void;
}) {
  return (
    <div>
      <div className="flex items-center px-0 md:px-4 py-2.5">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
      </div>
      {/* Mobile: Mail-style rows, no card chrome. Multi-select stays desktop-only.
          Full-bleed (-mx-4) so swipe rows reach the viewport edges. */}
      <div className="md:hidden -mx-4">
        {loading ? (
          <SkeletonMobileRows />
        ) : emails.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">{emptyLabel}</p>
        ) : (
          emails.map((email) => {
            if (pendingDeleteIds.has(email.id)) return null;
            const addresses = email.to_address.split(",").map((s) => s.trim()).filter(Boolean);
            const broken = email.status === "failed" || email.status === "bounced";
            return (
              <SwipeableRow
                key={email.id}
                onDelete={() => onSwipeDelete(email)}
                onClick={() => onRowClick(email)}
              >
              <div className="flex items-start gap-3 px-4 py-3.5 cursor-pointer">
                <ClientSquircle
                  name={email.client_name ?? email.to_address}
                  color={email.client_name ? (email.client_color ?? "#9ca3af") : "#9ca3af"}
                  className="size-8 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{addresses[0]}</span>
                    {addresses.length > 1 && (
                      <span className="text-xs text-muted-foreground border rounded-full px-1.5 py-px shrink-0">
                        +{addresses.length - 1}
                      </span>
                    )}
                    <span className="ml-auto flex items-center gap-1.5 shrink-0">
                      {email.filename && <Paperclip className="size-3.5 text-muted-foreground" />}
                      <span className="text-xs text-muted-foreground">{emailDate(email)}</span>
                    </span>
                  </div>
                  <p className="text-xs truncate">{email.subject}</p>
                  <div className="flex items-start gap-2">
                    <p className="text-xs text-muted-foreground truncate flex-1 min-w-0">
                      {email.body_text.replace(/\s+/g, " ")}
                    </p>
                    {broken && (
                      <Badge variant="destructive" className="shrink-0">{email.status}</Badge>
                    )}
                  </div>
                </div>
              </div>
              </SwipeableRow>
            );
          })
        )}
      </div>
      <div className="rounded-lg border overflow-hidden bg-card hidden md:block">
      <Table className="table-fixed">
        <TableBody>
          {loading ? (
            <SkeletonTableRows />
          ) : emails.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                {emptyLabel}
              </TableCell>
            </TableRow>
          ) : (
            emails.map((email) => (
              <TableRow key={email.id} className="cursor-pointer" onClick={() => onRowClick(email)}>
                <TableCell className="py-3 pl-4 pr-0 w-10" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selected.has(email.id)}
                    onCheckedChange={() => onToggle(email.id)}
                    aria-label={`Select email to ${email.client_name ?? email.to_address}`}
                  />
                </TableCell>
                <TableCell className="py-3 px-6 w-72">
                  <div className="flex items-center gap-3 min-w-0">
                    <ClientSquircle
                      name={email.client_name ?? email.to_address}
                      color={email.client_name ? (email.client_color ?? "#9ca3af") : "#9ca3af"}
                      className="size-[22px] shrink-0"
                    />
                    {(() => {
                      const addresses = email.to_address.split(",").map((s) => s.trim()).filter(Boolean);
                      return (
                        <>
                          <span className="text-sm truncate">{addresses[0]}</span>
                          {addresses.length > 1 && (
                            <span className="text-xs text-muted-foreground border rounded-full px-1.5 py-px shrink-0">
                              +{addresses.length - 1}
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </TableCell>
                <TableCell className="py-3 px-6 max-w-0">
                  <span className="text-sm block truncate">
                    {email.subject}
                    <span className="text-muted-foreground"> · {email.body_text.replace(/\s+/g, " ")}</span>
                  </span>
                </TableCell>
                <TableCell className="py-3 px-2 w-8">
                  {email.filename && <Paperclip className="size-3.5 text-muted-foreground ml-auto" />}
                </TableCell>
                {showStatus ? (
                  <TableCell className="py-3 pl-2 pr-6 w-56 text-right whitespace-nowrap">
                    {email.status === "pending" ? (
                      <Badge variant="outline">{scheduledLabel(email)}</Badge>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <Badge variant="destructive">{email.status}</Badge>
                        <span className="text-sm text-muted-foreground">{emailDate(email)}</span>
                      </span>
                    )}
                  </TableCell>
                ) : (
                  <TableCell className="py-3 pl-2 pr-6 w-24 text-right whitespace-nowrap">
                    <span className="text-sm text-muted-foreground">{emailDate(email)}</span>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}

export function EmailsClient({ emails }: { emails?: DashboardEmail[] }) {
  const [composeOpen, setComposeOpen] = useState(false);
  const [sentSheetOpen, setSentSheetOpen] = useState(false);
  const [composeInvoice, setComposeInvoice] = useState<InvoiceDetail | null>(null);
  const [composeBusinessName, setComposeBusinessName] = useState("");
  const [composeUserName, setComposeUserName] = useState("");
  const [composePrefill, setComposePrefill] = useState<ComposePrefill | null>(null);
  const [sentEmail, setSentEmail] = useState<DashboardEmail | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  // Swiped-away rows hide immediately; the real deletion runs only after the
  // undo toast times out (deleteEmails is irreversible — jobs, PDFs).
  const [pendingDelete, setPendingDelete] = useState<Set<string>>(new Set());
  const deleteTimers = useRef<Map<string, number>>(new Map());

  const loading = !emails;
  const scheduled = emails?.filter((e) => e.status !== "sent") ?? [];
  const sent = emails?.filter((e) => e.status === "sent") ?? [];

  function openNewEmail() {
    setComposeInvoice(null);
    setComposePrefill(null);
    setComposeOpen(true);
  }

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent<string>).detail === "emails") openNewEmail();
    };
    window.addEventListener("dock:new", handler);
    return () => window.removeEventListener("dock:new", handler);
  }, []);

  async function handleEmailRowClick(email: DashboardEmail) {
    if (email.status === "sent") {
      setSentEmail(email);
      setSentSheetOpen(true);
      return;
    }
    const failReason = email.status === "failed" || email.status === "bounced" ? email.error : null;
    // Free-form emails have no invoice to load — edit directly.
    if (!email.invoice_id) {
      setComposeInvoice(null);
      setComposePrefill({
        to: email.to_address.split(",").map((s) => s.trim()).filter(Boolean),
        subject: email.subject,
        body: email.body_text,
        scheduledFor: new Date(email.scheduled_for),
        editingId: email.id,
        error: failReason,
      });
      setComposeOpen(true);
      return;
    }
    const result = await loadScheduledEmail(email.invoice_id);
    if (result.invoiceDetail) {
      setComposeInvoice(result.invoiceDetail);
      setComposeBusinessName(result.businessName);
      setComposeUserName(result.userName);
      setComposePrefill({
        to: email.to_address.split(",").map((s) => s.trim()).filter(Boolean),
        subject: email.subject,
        body: email.body_text,
        scheduledFor: new Date(email.scheduled_for),
        editingId: email.id,
        error: failReason,
      });
      setComposeOpen(true);
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteEmails([...selected]);
      setSelected(new Set());
      invalidate("emails", "invoices");
      toast.success(selected.size === 1 ? "Email deleted" : `${selected.size} emails deleted`);
    } finally {
      setDeleting(false);
    }
  }

  function handleSwipeDelete(email: DashboardEmail) {
    setPendingDelete((prev) => new Set(prev).add(email.id));
    const timer = window.setTimeout(async () => {
      deleteTimers.current.delete(email.id);
      try {
        await deleteEmails([email.id]);
        invalidate("emails", "invoices");
      } catch {
        toast.error("Failed to delete email");
        setPendingDelete((prev) => {
          const next = new Set(prev);
          next.delete(email.id);
          return next;
        });
      }
    }, 4000);
    deleteTimers.current.set(email.id, timer);
    toast("Email deleted", {
      duration: 4000,
      action: {
        label: "Undo",
        onClick: () => {
          const t = deleteTimers.current.get(email.id);
          if (t) window.clearTimeout(t);
          deleteTimers.current.delete(email.id);
          setPendingDelete((prev) => {
            const next = new Set(prev);
            next.delete(email.id);
            return next;
          });
        },
      },
    });
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Emails">
        <Button size="sm" className="hidden md:flex" disabled={loading} onClick={openNewEmail}>
          <Pencil className="size-4" />
          Compose
        </Button>
        {selected.size > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={deleting}>
                Delete ({selected.size})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Delete {selected.size === 1 ? "this email" : `${selected.size} emails`}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Scheduled emails will be cancelled, and sent emails will be removed from history along with their archived PDFs. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </PageHeader>

      <div className="flex-1 overflow-y-auto pb-28 md:pb-0">
        <div className="px-4 md:px-6 pb-6 pt-1 md:pt-6 mx-auto w-full max-w-6xl flex flex-col gap-0 md:gap-4">
          {!loading && scheduled.length > 0 && (
            <EmailsTable title="Scheduled" emails={scheduled} onRowClick={handleEmailRowClick} showStatus selected={selected} onToggle={toggleSelected} pendingDeleteIds={pendingDelete} onSwipeDelete={handleSwipeDelete} />
          )}
          <EmailsTable
            title="Sent"
            emails={sent}
            onRowClick={handleEmailRowClick}
            loading={loading}
            emptyLabel="No sent emails yet."
            selected={selected}
            onToggle={toggleSelected}
            pendingDeleteIds={pendingDelete}
            onSwipeDelete={handleSwipeDelete}
          />
        </div>
      </div>

      <EmailComposeSheet
        open={composeOpen}
        onOpenChangeAction={(open) => {
          setComposeOpen(open);
          if (!open) { setComposeInvoice(null); setComposePrefill(null); }
        }}
        invoice={composeInvoice}
        businessName={composeBusinessName}
        userName={composeUserName}
        onSent={() => { setComposeInvoice(null); setComposePrefill(null); }}
        initialTo={composePrefill?.to}
        initialSubject={composePrefill?.subject}
        initialBody={composePrefill?.body}
        initialScheduledFor={composePrefill?.scheduledFor}
        editingId={composePrefill?.editingId}
        errorReason={composePrefill?.error}
        freeform
      />
      <SentEmailSheet
        open={sentSheetOpen}
        onOpenChangeAction={setSentSheetOpen}
        email={sentEmail}
      />
    </div>
  );
}
