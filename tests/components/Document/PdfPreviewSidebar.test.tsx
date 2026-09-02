import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

/* ---------- hoisted mock react-hot-toast ---------- */
const { mockToast } = vi.hoisted(() => {
  const toastFn = vi.fn();
  const errorFn = vi.fn();
  return {
    mockToast: Object.assign(toastFn, { error: errorFn }),
  };
});

vi.mock("react-hot-toast", () => ({
  default: mockToast,
}));

/* ---------- mock child components ---------- */
vi.mock("@/components/Document/SaveSentenzaButton", () => ({
  SaveSentenzaButton: ({ userId, sentenzaId }: { userId: string; sentenzaId: string }) => (
    <div data-testid="mock-save-sentenza-button">
      <span>User: {userId}</span>
      <span>Sentenza: {sentenzaId}</span>
    </div>
  ),
}));

vi.mock("@/components/FeedbackComponent", () => ({
  FeedbackComponent: ({ sourceIds }: { sourceIds: string }) => (
    <div data-testid="mock-feedback-component">
      <span>Source: {sourceIds}</span>
    </div>
  ),
}));

/* ---------- mock react-icons ---------- */
vi.mock("react-icons/fa", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid={`fa-${name}`} {...props} />
  );
  return {
    FaFilePdf: Icon("file-pdf"),
    FaShareAlt: Icon("share-alt"),
    FaFileAudio: Icon("file-audio"),
    FaEnvelope: Icon("envelope"),
  };
});

vi.mock("react-icons/fi", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid={`fi-${name}`} {...props} />
  );
  return {
    FiMail: Icon("mail"),
    FiPlay: Icon("play"),
    FiPause: Icon("pause"),
    FiRotateCcw: Icon("rotate-ccw"),
    FiRotateCw: Icon("rotate-cw"),
  };
});

/* ---------- component ---------- */
import { PdfPreviewSidebar } from "@/components/Document/PdfPreviewSidebar";

describe("PdfPreviewSidebar Component Suite", () => {
  const mockPlay = vi.fn().mockResolvedValue(undefined);
  const mockPause = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    window.HTMLMediaElement.prototype.play = mockPlay;
    window.HTMLMediaElement.prototype.pause = mockPause;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderSidebar = (
    props: Partial<React.ComponentProps<typeof PdfPreviewSidebar>> = {}
  ) => {
    const defaultProps: React.ComponentProps<typeof PdfPreviewSidebar> = {
      file: "https://storage.jurio.it/docs/sentenza_1234_2026.pdf",
      nomeFile: "Sentenza_1234_2026.pdf",
      share: false,
      uid: "user-100",
      id: "doc-200",
      ...props,
    };

    return render(<PdfPreviewSidebar {...defaultProps} />);
  };

  test("renderizza la preview PDF standard con iframe, link di download e feedback", () => {
    renderSidebar();

    const downloadLink = screen.getByRole("link", { name: /Scarica PDF/i });
    expect(downloadLink).toBeInTheDocument();
    expect(downloadLink).toHaveAttribute("href", "https://storage.jurio.it/docs/sentenza_1234_2026.pdf");
    expect(downloadLink).toHaveAttribute("download");

    expect(screen.getByTestId("mock-feedback-component")).toBeInTheDocument();
    expect(screen.getByText("Source: doc-200")).toBeInTheDocument();

    const iframe = screen.getByTitle("Preview");
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute("src", "https://storage.jurio.it/docs/sentenza_1234_2026.pdf#view=FitH");

    expect(
      screen.getByText("Se l’anteprima non appare, usa “Apri” o scarica il file.")
    ).toBeInTheDocument();
  });

  test("rileva file audio (.mp3) e renderizza il player audio con controlli di riproduzione", () => {
    const { container } = renderSidebar({
      file: "https://storage.jurio.it/audio/udienza.mp3",
      nomeFile: "Registrazione_Udienza.mp3",
    });

    expect(screen.getByRole("link", { name: /Scarica Audio/i })).toBeInTheDocument();
    expect(screen.getByTitle("Registrazione_Udienza.mp3")).toBeInTheDocument();
    expect(screen.queryByTitle("Preview")).toBeNull();

    const audioElement = container.querySelector("audio");
    expect(audioElement).toBeInTheDocument();
    expect(audioElement).toHaveAttribute("src", "https://storage.jurio.it/audio/udienza.mp3");

    // Toggle Play
    const playBtn = screen.getByTestId("fi-play").closest("button")!;
    fireEvent.click(playBtn);
    expect(mockPlay).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("fi-pause")).toBeInTheDocument();

    // Toggle Pause
    const pauseBtn = screen.getByTestId("fi-pause").closest("button")!;
    fireEvent.click(pauseBtn);
    expect(mockPause).toHaveBeenCalledTimes(1);

    // Skip Buttons
    const skipBackBtn = screen.getByTitle("Indietro di 15 secondi");
    const skipForwardBtn = screen.getByTitle("Avanti di 15 secondi");
    fireEvent.click(skipBackBtn);
    fireEvent.click(skipForwardBtn);

    expect(
      screen.queryByText("Se l’anteprima non appare, usa “Apri” o scarica il file.")
    ).toBeNull();
  });

  test("rileva file email (.eml / .msg) e mostra l'avviso di download dedicato", () => {
    renderSidebar({
      file: "https://storage.jurio.it/mail/comunicazione_pec.eml",
      nomeFile: "comunicazione_pec.eml",
    });

    expect(screen.getByRole("link", { name: /Scarica Email/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Archivio Email", level: 4 })).toBeInTheDocument();
    expect(
      screen.getByText(/I file di posta elettronica non possono essere visualizzati direttamente nel browser/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Scarica Messaggio/i })).toHaveAttribute(
      "href",
      "https://storage.jurio.it/mail/comunicazione_pec.eml"
    );
  });

  test("condivide tramite Web Share API quando supportata (share: true)", async () => {
    const mockShare = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      writable: true,
      configurable: true,
      value: mockShare,
    });

    renderSidebar({ share: true });

    expect(screen.getByTestId("mock-save-sentenza-button")).toBeInTheDocument();
    expect(screen.getByText("User: user-100")).toBeInTheDocument();
    expect(screen.getByText("Sentenza: doc-200")).toBeInTheDocument();

    const shareBtn = screen.getByRole("button", { name: /Condividi/i });
    fireEvent.click(shareBtn);

    await waitFor(() => {
      expect(mockShare).toHaveBeenCalledTimes(1);
      expect(mockShare).toHaveBeenCalledWith({
        title: "Condivisione Documento",
        url: window.location.href,
      });
    });
  });

  test("copia il link negli appunti con fallback a toast quando Web Share API non è presente", async () => {
    Object.defineProperty(navigator, "share", {
      writable: true,
      configurable: true,
      value: undefined,
    });

    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      writable: true,
      configurable: true,
      value: { writeText: mockWriteText },
    });

    renderSidebar({ share: true });

    const shareBtn = screen.getByRole("button", { name: /Condividi/i });
    fireEvent.click(shareBtn);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith(window.location.href);
      expect(mockToast).toHaveBeenCalledWith("Link copiato negli appunti");
    });
  });

  test("mostra toast.error se la copia negli appunti fallisce", async () => {
    Object.defineProperty(navigator, "share", {
      writable: true,
      configurable: true,
      value: undefined,
    });

    const mockWriteText = vi.fn().mockRejectedValue(new Error("Clipboard denied"));
    Object.defineProperty(navigator, "clipboard", {
      writable: true,
      configurable: true,
      value: { writeText: mockWriteText },
    });

    renderSidebar({ share: true });

    const shareBtn = screen.getByRole("button", { name: /Condividi/i });
    fireEvent.click(shareBtn);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Errore nella copia del link");
    });
  });
});