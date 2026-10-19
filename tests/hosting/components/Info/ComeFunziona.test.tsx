import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ComeFunziona } from "@/features/search/components/ComeFunziona"; // Adatta il path in base alla struttura del tuo progetto
import { useReducedMotion } from "framer-motion";

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
    motion: {
      h1: ({ children, id, className, style }: React.HTMLAttributes<HTMLHeadingElement>) => (
        <h1 id={id} className={className} style={style}>
          {children}
        </h1>
      ),
      p: ({ children, className }: React.HTMLAttributes<HTMLParagraphElement>) => (
        <p className={className}>{children}</p>
      ),
      li: ({ children, className }: React.LiHTMLAttributes<HTMLLIElement>) => (
        <li className={className}>{children}</li>
      ),
    },
  };
});

const mockedUseReducedMotion = vi.mocked(useReducedMotion);

describe("ComeFunziona Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseReducedMotion.mockReturnValue(false);
  });

  test("renderizza correttamente l'header della sezione e il titolo accessibile", () => {
    render(<ComeFunziona />);

    const section = screen.getByRole("region", {
      name: /come funziona la ricerca giurisprudenziale su jurio/i,
    });
    expect(section).toBeInTheDocument();

    const heading = screen.getByRole("heading", {
      level: 1,
      name: /come funziona la ricerca giurisprudenziale su jurio/i,
    });
    expect(heading).toBeInTheDocument();

    expect(
      screen.getByText(/jurio unisce la giurisprudenza delle corti supreme già elaborata/i)
    ).toBeInTheDocument();
  });

  test("renderizza la lista ordinata con esattamente 3 fasi di processo", () => {
    render(<ComeFunziona />);

    const list = screen.getByRole("list");
    expect(list).toBeInTheDocument();

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
  });

  test("mostra correttamente i titoli, le descrizioni e i watermark numerici per ciascuna fase", () => {
    render(<ComeFunziona />);

    const expectedSteps = [
      {
        watermark: "01",
        title: "Tutta la giurisprudenza che conta",
        descSnippet: /ricerca nei provvedimenti di cassazione civile/i,
      },
      {
        watermark: "02",
        title: "Comprende il contenuto delle decisioni",
        descSnippet: /ogni provvedimento è stato analizzato nei suoi elementi giuridici essenziali/i,
      },
      {
        watermark: "03",
        title: "Trova i precedenti più pertinenti",
        descSnippet: /la ricerca non si limita alle parole utilizzate nel quesito/i,
      },
    ];

    const listItems = screen.getAllByRole("listitem");

    expectedSteps.forEach((step, index) => {
      const itemScope = within(listItems[index]);

      expect(itemScope.getByText(step.watermark)).toBeInTheDocument();
      expect(
        itemScope.getByRole("heading", { level: 3, name: step.title })
      ).toBeInTheDocument();
      expect(itemScope.getByText(step.descSnippet)).toBeInTheDocument();
    });
  });

  test("si renderizza regolarmente anche quando è attiva la preferenza reduced motion", () => {
    mockedUseReducedMotion.mockReturnValue(true);

    render(<ComeFunziona />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /come funziona la ricerca giurisprudenziale su jurio/i,
      })
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});