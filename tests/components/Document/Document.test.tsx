import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import type {
  Sentenza,
  Ordinanza,
  Decreto,
  DocumentoGiurisprudenziale
} from "@/interfaces/interfaces";

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid={`icon-${name}`} {...props} />
  );
  return {
    ChevronDown: Icon("chevron-down"),
    TextQuote: Icon("text-quote"),
  };
});

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      children,
      className,
      onClick,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { [key: string]: unknown }) => (
      <div className={className} onClick={onClick} {...props}>
        {children}
      </div>
    ),
  },
}));

/* ---------- component ---------- */
import { Document } from "@/features/document/components/Document"; // <-- adegua il path se necessario

describe("Document Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const dummySentenza: Sentenza = {
    id: "sent-101",
    tipo_documento: "sentenza",
    organo_giudicante: "Corte di Cassazione Civile",
    sezione: "Sezione Prima Civile",
    numero_sentenza: "1234/2026",
    data_sentenza: "2026-03-15T00:00:00.000Z",
    massima: "In tema di contratti bancari, la clausola di anatocismo è nulla.",
    ecli: "ECLI:IT:CASS:2026:1234CIV",
    urn: "urn:nir:stato:corte.cassazione:sentenza:2026-03-15;1234",
  } as unknown as Sentenza;

  test("renderizza le informazioni base di una sentenza giurisprudenziale (badge, organo, sezione, data, massima, ecli e URN)", () => {
    render(<Document documento={dummySentenza} />);

    expect(screen.getByText("SENTENZA")).toBeInTheDocument();
    expect(screen.getByText("Corte di Cassazione Civile")).toBeInTheDocument();
    expect(screen.getByText("Sezione Prima Civile")).toBeInTheDocument();
    expect(screen.getByText("n. 1234/2026")).toBeInTheDocument();
    expect(screen.getByText("ECLI:IT:CASS:2026:1234CIV")).toBeInTheDocument();
    expect(screen.getByText("In tema di contratti bancari, la clausola di anatocismo è nulla.")).toBeInTheDocument();
    expect(screen.getByText("urn:nir:stato:corte.cassazione:sentenza:2026-03-15;1234")).toBeInTheDocument();
  });

  test("mostra il logo ufficiale della Cassazione quando l'organo giudicante include 'CASSAZIONE'", () => {
    render(<Document documento={dummySentenza} />);

    const logoCassazione = screen.getByAltText("Corte di Cassazione");
    expect(logoCassazione).toBeInTheDocument();
    expect(logoCassazione).toHaveAttribute(
      "src",
      "https://www.cortedicassazione.it/resources/static/img/portale/CDC-Logo.svg"
    );
  });

  test("renderizza logo e link personalizzati quando la fonte esterna non è Cassazione", () => {
    const docFonteEsterna = {
      ...dummySentenza,
      organo_giudicante: "Tribunale di Milano",
      logo_fonte: "https://example.com/logo-giustizia.svg",
      fonte: "https://giurisprudenza.tribunale.milano.it/sent-101",
    } as unknown as Sentenza;

    render(<Document documento={docFonteEsterna} />);

    const logoImg = screen.getByAltText("https://giurisprudenza.tribunale.milano.it/sent-101");
    expect(logoImg).toHaveAttribute("src", "https://example.com/logo-giustizia.svg");

    const fonteLink = screen.getByRole("link", {
      name: "https://giurisprudenza.tribunale.milano.it/sent-101",
    });
    expect(fonteLink).toHaveAttribute("href", "https://giurisprudenza.tribunale.milano.it/sent-101");
    expect(fonteLink).toHaveAttribute("target", "_blank");
  });

  test("mostra 'Documento caricato' se il documento non è di tipo giurisprudenziale", () => {
    const genericDoc = {
      id: "doc-gen-1",
      tipo_documento: "documento_generico",
    } as unknown as DocumentoGiurisprudenziale;

    render(<Document documento={genericDoc} />);

    expect(screen.getByText("DOCUMENTO GENERICO")).toBeInTheDocument();
    expect(screen.getByText("Documento caricato")).toBeInTheDocument();
  });

  test("renderizza le specifiche per un'ordinanza, inclusi i dettagli cautelari (misura, fumus, periculum)", () => {
    const ordinanzaDoc: Ordinanza = {
      id: "ord-202",
      tipo_documento: "ordinanza",
      organo_giudicante: "Consiglio di Stato",
      massima: "Sospensione dell'esecutività del provvedimento amministrativo.",
      tipo_ordinanza: "cautelare",
      efficacia_temporale: "Fino al giudizio di merito",
      misura_disposta: "Sospensione dell'atto impugnato",
      fumus_boni_iuris: "Sussistente per palese difetto di motivazione",
      periculum_in_mora: "Grave e irreparabile danno economico",
    } as unknown as Ordinanza;

    render(<Document documento={ordinanzaDoc} />);

    expect(screen.getByText("ORDINANZA")).toBeInTheDocument();
    expect(screen.getByText("Ordinanza cautelare")).toBeInTheDocument();
    expect(screen.getByText("Efficacia: Fino al giudizio di merito")).toBeInTheDocument();
    expect(screen.getByText("Sospensione dell'atto impugnato")).toBeInTheDocument();
    expect(screen.getByText("Sussistente per palese difetto di motivazione")).toBeInTheDocument();
    expect(screen.getByText("Grave e irreparabile danno economico")).toBeInTheDocument();
  });

  test("renderizza le specifiche per un decreto (contraddittorio, autorita monocratica, dispositivo)", () => {
    const decretoDoc: Decreto = {
      id: "dec-303",
      tipo_documento: "decreto",
      organo_giudicante: "Tribunale di Roma",
      massima: "Ingiunzione di pagamento provvisoriamente esecutiva.",
      tipo_decreto: "ingiuntivo",
      contraddittorio: false,
      autorita_monocratica: true,
      contenuto_precettivo: "Ingiunge alla parte debitrice il pagamento di euro 10.000.",
    } as unknown as Decreto;

    render(<Document documento={decretoDoc} />);

    expect(screen.getByText("DECRETO")).toBeInTheDocument();
    expect(screen.getByText("Decreto ingiuntivo")).toBeInTheDocument();
    expect(screen.getByText("Contraddittorio: no")).toBeInTheDocument();
    expect(screen.getByText("Monocratico: sì")).toBeInTheDocument();
    expect(screen.getByText("Ingiunge alla parte debitrice il pagamento di euro 10.000.")).toBeInTheDocument();
  });

  test("gestisce la formattazione della data sia tramite oggetto Firestore Timestamp che fallback dataSentenza", () => {
    const mockTimestamp = {
      toDate: () => new Date("2026-05-20T10:00:00Z"),
    };

    const docConTimestamp = {
      ...dummySentenza,
      data_sentenza: null,
      dataSentenza: mockTimestamp,
    } as unknown as Sentenza;

    render(<Document documento={docConTimestamp} />);

    const expectedDate = new Date("2026-05-20T10:00:00Z").toLocaleDateString();
    expect(screen.getByText(expectedDate)).toBeInTheDocument();
  });

  test("gestisce l'espansione e la compressione della sintesi pertinente (highlighted_preview)", () => {
    const docConPreview = {
      ...dummySentenza,
      highlighted_preview: "Estratto saliente: <mark>la delibera assembleare è annullabile</mark>.",
    } as unknown as Sentenza;

    render(<Document documento={docConPreview} />);

    const toggleBtn = screen.getByRole("button", { name: /Mostra sintesi pertinente/i });
    expect(toggleBtn).toBeInTheDocument();
    expect(screen.queryByText(/la delibera assembleare è annullabile/i)).toBeNull();

    // Apertura preview
    fireEvent.click(toggleBtn);
    expect(screen.getByText(/Mostra sintesi pertinente|Nascondi sintesi/i)).toHaveTextContent("Nascondi sintesi");
    expect(screen.getByText(/la delibera assembleare è annullabile/i)).toBeInTheDocument();

    // Chiusura preview
    fireEvent.click(toggleBtn);
    expect(screen.queryByText(/la delibera assembleare è annullabile/i)).toBeNull();
  });
});