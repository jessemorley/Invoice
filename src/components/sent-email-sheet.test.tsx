import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DashboardEmail } from "@/lib/types";
import { SentEmailSheet } from "./sent-email-sheet";

const getSentEmailPdfUrlMock = vi.fn();

vi.mock("@/app/(app)/invoices/actions", () => ({
  getSentEmailPdfUrl: (...args: unknown[]) => getSentEmailPdfUrlMock(...args),
}));

vi.mock("sonner", () => ({ toast: { warning: vi.fn(), error: vi.fn() } }));

function makeEmail(overrides: Partial<DashboardEmail> = {}): DashboardEmail {
  return {
    id: "email-1",
    invoice_id: "invoice-1",
    invoice_number: "INV-001",
    to_address: "customer@example.com",
    subject: "Invoice INV-001",
    body_text: "Hi, please find your invoice attached.",
    filename: "Acme Invoice INV-001.pdf",
    scheduled_for: "2026-05-20T10:00:00.000Z",
    sent_at: "2026-05-20T10:00:01.000Z",
    sent_pdf_path: "user-1/invoice-1/email-1.pdf",
    status: "sent",
    ...overrides,
  };
}

const windowOpen = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "open", { value: windowOpen, writable: true });
  Object.defineProperty(navigator, "maxTouchPoints", { value: 0, configurable: true });
});

describe("SentEmailSheet — State A (archived copy present)", () => {
  it("opens the signed URL in a new tab when the attachment button is clicked", async () => {
    const user = userEvent.setup();
    getSentEmailPdfUrlMock.mockResolvedValue("https://signed.example/pdf?token=abc");

    render(
      <SentEmailSheet open={true} onOpenChangeAction={vi.fn()} email={makeEmail()} />
    );

    await user.click(screen.getByRole("button", { name: /Acme Invoice INV-001\.pdf/i }));

    await waitFor(() => {
      expect(getSentEmailPdfUrlMock).toHaveBeenCalledWith("email-1");
      expect(windowOpen).toHaveBeenCalledWith(
        "https://signed.example/pdf?token=abc",
        "_blank",
        expect.any(String)
      );
    });
  });

  it("does not render the 'archive unavailable' messaging when sent_pdf_path is present", () => {
    render(
      <SentEmailSheet open={true} onOpenChangeAction={vi.fn()} email={makeEmail()} />
    );
    expect(screen.queryByText(/archived copy unavailable/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /view current invoice pdf/i })).not.toBeInTheDocument();
  });
});

describe("SentEmailSheet — State B (archive missing)", () => {
  it("renders 'Archived copy unavailable' when sent_pdf_path is null", () => {
    render(
      <SentEmailSheet
        open={true}
        onOpenChangeAction={vi.fn()}
        email={makeEmail({ sent_pdf_path: null })}
      />
    );
    expect(screen.getByText(/archived copy unavailable/i)).toBeInTheDocument();
  });

  it("primary attachment button is disabled when archive is missing", () => {
    render(
      <SentEmailSheet
        open={true}
        onOpenChangeAction={vi.fn()}
        email={makeEmail({ sent_pdf_path: null })}
      />
    );
    const attachmentButton = screen.getByRole("button", { name: /archived copy unavailable/i });
    expect(attachmentButton).toBeDisabled();
  });

  it("offers a secondary 'View current invoice PDF' link that opens the current-state PDF", async () => {
    const user = userEvent.setup();
    render(
      <SentEmailSheet
        open={true}
        onOpenChangeAction={vi.fn()}
        email={makeEmail({ sent_pdf_path: null })}
      />
    );
    const fallback = screen.getByRole("button", { name: /view current invoice pdf/i });
    await user.click(fallback);
    expect(windowOpen).toHaveBeenCalledWith(
      "/api/invoices/invoice-1/pdf",
      "_blank",
      expect.any(String)
    );
    expect(getSentEmailPdfUrlMock).not.toHaveBeenCalled();
  });

  it("falls back to State B when getSentEmailPdfUrl returns null at click time", async () => {
    const user = userEvent.setup();
    getSentEmailPdfUrlMock.mockResolvedValue(null);

    render(
      <SentEmailSheet open={true} onOpenChangeAction={vi.fn()} email={makeEmail()} />
    );

    await user.click(screen.getByRole("button", { name: /Acme Invoice INV-001\.pdf/i }));

    await waitFor(() => {
      expect(getSentEmailPdfUrlMock).toHaveBeenCalledWith("email-1");
    });
    expect(windowOpen).not.toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: /view current invoice pdf/i })).toBeInTheDocument();
  });
});
