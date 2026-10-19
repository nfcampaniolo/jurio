import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", async () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { [key: string]: unknown }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

/* ---------- component ---------- */
import { MessageTimeline } from "@/features/chat/components/MessageTimeline"; // <-- adegua il path se necessario
import type { Message } from "@/interfaces/interfaces";

describe("MessageTimeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("non renderizza nulla se ci sono meno di 2 messaggi utente", () => {
    // 1. Array vuoto
    const { container, rerender } = render(<MessageTimeline messages={[]} />);
    expect(container.firstChild).toBeNull();

    // 2. Solo 1 messaggio utente
    const singleUserMessage: Message[] = [
      { id: "u1", role: "user", content: "Primo messaggio" } as Message,
      { id: "m1", role: "model", content: "Risposta 1" } as Message,
    ];
    rerender(<MessageTimeline messages={singleUserMessage} />);
    expect(container.firstChild).toBeNull();

    // 3. Solo messaggi del modello
    const onlyModelMessages: Message[] = [
      { id: "m1", role: "model", content: "Risposta 1" } as Message,
      { id: "m2", role: "model", content: "Risposta 2" } as Message,
    ];
    rerender(<MessageTimeline messages={onlyModelMessages} />);
    expect(container.firstChild).toBeNull();
  });

  test("renderizza gli indicatori per ogni messaggio utente con anteprima e troncamento oltre i 100 caratteri", () => {
    const longContent =
      "Questo è un quesito giuridico particolarmente lungo e articolato formulato per verificare il corretto funzionamento della logica di troncamento del testo della preview oltre i cento caratteri.";
    const shortContent = "Domanda breve e concisa.";

    const messages: Message[] = [
      { id: "u1", role: "user", content: shortContent } as Message,
      { id: "m1", role: "model", content: "Risposta intermedia del modello" } as Message,
      { id: "u2", role: "user", content: longContent } as Message,
    ];

    render(<MessageTimeline messages={messages} />);

    // Verifica anteprima messaggio corto (non troncato)
    expect(screen.getByText(shortContent)).toBeInTheDocument();

    // Verifica anteprima messaggio lungo (troncato a 100 caratteri + "...")
    const expectedTruncated = longContent.substring(0, 100) + "...";
    expect(screen.getByText(expectedTruncated)).toBeInTheDocument();
  });

  test("esegue scrollIntoView verso l'elemento del messaggio al click sull'indicatore", () => {
    const mockScrollIntoView = vi.fn();

    // Crea elementi target fittizi nel DOM
    const targetElement1 = document.createElement("div");
    targetElement1.id = "msg-u1";
    targetElement1.scrollIntoView = mockScrollIntoView;
    document.body.appendChild(targetElement1);

    const targetElement2 = document.createElement("div");
    targetElement2.id = "msg-u2";
    targetElement2.scrollIntoView = mockScrollIntoView;
    document.body.appendChild(targetElement2);

    const messages: Message[] = [
      { id: "u1", role: "user", content: "Prima domanda" } as Message,
      { id: "u2", role: "user", content: "Seconda domanda" } as Message,
    ];

    render(<MessageTimeline messages={messages} />);

    // Click sul primo indicatore
    const tooltip1 = screen.getByText("Prima domanda");
    const indicator1 = tooltip1.closest(".cursor-pointer")!;
    fireEvent.click(indicator1);

    expect(mockScrollIntoView).toHaveBeenCalledTimes(1);
    expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });

    // Pulizia DOM
    document.body.removeChild(targetElement1);
    document.body.removeChild(targetElement2);
  });

  test("gestisce senza errori il click se l'elemento target non è presente nel DOM", () => {
    const messages: Message[] = [
      { id: "missing-1", role: "user", content: "Domanda 1" } as Message,
      { id: "missing-2", role: "user", content: "Domanda 2" } as Message,
    ];

    render(<MessageTimeline messages={messages} />);

    const tooltip = screen.getByText("Domanda 1");
    const indicator = tooltip.closest(".cursor-pointer")!;

    // Non deve lanciare eccezioni
    expect(() => fireEvent.click(indicator)).not.toThrow();
  });
});