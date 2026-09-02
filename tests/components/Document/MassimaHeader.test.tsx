import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import type { Sentenza, DocumentoGiurisprudenzaGenerico } from "@/interfaces/interfaces";

/* ---------- mock react-icons/fa ---------- */
vi.mock("react-icons/fa", () => ({
  FaBook: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="fa-book" {...props} />,
  FaFileAlt: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="fa-file-alt" {...props} />,
  FaCalendarAlt: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="fa-calendar-alt" {...props} />,
  FaUser: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="fa-user" {...props} />,
  FaEuroSign: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="fa-euro-sign" {...props} />,
}));

/* ---------- component ---------- */
import { MassimaHeader } from "@/components/Document/MassimaHeader"; // <-- adegua il path se necessario

describe("MassimaHeader Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza organo giudicante, sezione e tutti i metadati di una sentenza standard", () => {
    const mockSentenza: Sentenza = {
      organo_giudicante: "Corte di Cassazione",
      sezione: "Sezione Prima Civile",
      numero_sentenza: "12345/2026",
      data_sentenza: "15/03/2026",
      grado_giudizio: "Legittimità",
      ecli: "ECLI:IT:CASS:2026:12345CIV",
    } as unknown as Sentenza;

    render(
      <MassimaHeader
        result={mockSentenza}
        isGenerico={false}
        docGenerico={null}
      />
    );

    // Organo e Sezione
    expect(screen.getByTestId("fa-book")).toBeInTheDocument();
    expect(screen.getByText("Corte di Cassazione")).toBeInTheDocument();
    expect(screen.getByText("• Sezione Prima Civile")).toBeInTheDocument();

    // Metadati sentenza
    expect(screen.getByText("n. 12345/2026")).toBeInTheDocument();
    expect(screen.getByText("15/03/2026")).toBeInTheDocument();
    expect(screen.getByText("Legittimità")).toBeInTheDocument();
    expect(screen.getByText("ECLI:IT:CASS:2026:12345CIV")).toBeInTheDocument();
  });

  test("renderizza il sottotipo documento e i metadati specifici per un documento generico", () => {
    const mockDocGenerico: DocumentoGiurisprudenzaGenerico = {
      sottotipo_documento: "Memoria di Replica",
      sezione: "Sezione Lavoro",
      numero_sentenza: "RG 500/2026",
      data_riferimento_documento: "01/06/2026",
      mittente: "Avv. Mario Rossi",
      destinatario: "Tribunale di Torino",
      importo: 15450.5,
    } as unknown as DocumentoGiurisprudenzaGenerico;

    render(
      <MassimaHeader
        result={mockDocGenerico}
        isGenerico={true}
        docGenerico={mockDocGenerico}
      />
    );

    // Sottotipo con icona file
    expect(screen.getByTestId("fa-file-alt")).toBeInTheDocument();
    expect(screen.getByText("Memoria di Replica")).toBeInTheDocument();
    expect(screen.getByText("• Sezione Lavoro")).toBeInTheDocument();

    // Mittente e Destinatario
    expect(screen.getByText("Da: Avv. Mario Rossi")).toBeInTheDocument();
    expect(screen.getByText("A: Tribunale di Torino")).toBeInTheDocument();
    expect(screen.getAllByTestId("fa-user")).toHaveLength(2);

    // Data riferimento stringa
    expect(screen.getByTestId("fa-calendar-alt")).toBeInTheDocument();
    expect(screen.getByText("01/06/2026")).toBeInTheDocument();

    // Importo formattato in valuta italiana
    expect(screen.getByTestId("fa-euro-sign")).toBeInTheDocument();
    expect(screen.getByText(/15\.450,50/)).toBeInTheDocument();
  });

  test("formatta correttamente la data di riferimento quando passata come istanza Date", () => {
    const testDate = new Date("2026-09-01T10:00:00Z");
    const formattedDate = testDate.toLocaleDateString("it-IT");

    const mockDocGenerico: DocumentoGiurisprudenzaGenerico = {
      sottotipo_documento: "Atto di Precetto",
      data_riferimento_documento: testDate,
    } as unknown as DocumentoGiurisprudenzaGenerico;

    render(
      <MassimaHeader
        result={mockDocGenerico}
        isGenerico={true}
        docGenerico={mockDocGenerico}
      />
    );

    expect(screen.getByText(formattedDate)).toBeInTheDocument();
  });

  test("omette i badge per i campi opzionali non definiti senza generare errori", () => {
    const mockMinimalSentenza = {
      organo_giudicante: "Giudice di Pace",
    } as unknown as Sentenza;

    render(
      <MassimaHeader
        result={mockMinimalSentenza}
        isGenerico={false}
        docGenerico={null}
      />
    );

    expect(screen.getByText("Giudice di Pace")).toBeInTheDocument();
    expect(screen.queryByText(/n\./i)).toBeNull();
    expect(screen.queryByText(/ECLI/i)).toBeNull();
    expect(screen.queryByTestId("fa-user")).toBeNull();
    expect(screen.queryByTestId("fa-euro-sign")).toBeNull();
  });
});