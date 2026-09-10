import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import UserUsage from "@/features/profile/UserUsage"; // Adatta il path se necessario

/* ---------- hoisted mocks ---------- */
const { mockNavigate, mockUseAuth, mockUseUsageData, mockSeo } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseAuth: vi.fn(),
  mockUseUsageData: vi.fn(),
  mockSeo: vi.fn(),
}));

/* ---------- mock router & auth ---------- */
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/context/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

/* ---------- mock SEO component ---------- */
vi.mock("@/shared/components/SEO", () => ({
  SEO: (props: unknown) => {
    mockSeo(props);
    return null;
  },
}));

/* ---------- mock hook dati & formattatori ---------- */
vi.mock("@/features/profile/hooks/useUsageData", () => ({
  useUsageData: (...args: unknown[]) => mockUseUsageData(...args),
  formatMonthLabel: vi.fn((mese: string) => `Settembre ${mese.split("-")[0]}`),
  formatTimeHero: vi.fn((min: number) => ({
    value: String(Math.floor(min / 60)),
    unit: "ore",
  })),
  formatTimeCompact: vi.fn((min: number) => `${min}m`),
}));

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
    motion: {
      div: ({
        children,
        className,
        style,
        role,
        "aria-valuenow": valuenow,
        "aria-valuemin": valuemin,
        "aria-valuemax": valuemax,
        "aria-label": ariaLabel,
      }: {
        children?: React.ReactNode;
        className?: string;
        style?: React.CSSProperties;
        role?: string;
        "aria-valuenow"?: number;
        "aria-valuemin"?: number;
        "aria-valuemax"?: number;
        "aria-label"?: string;
      }) => (
        <div
          className={className}
          style={style}
          role={role}
          aria-valuenow={valuenow}
          aria-valuemin={valuemin}
          aria-valuemax={valuemax}
          aria-label={ariaLabel}
        >
          {children}
        </div>
      ),
    },
  };
});

describe("UserUsage Component Suite", () => {
  const defaultLimits = {
    research: 100,
    analysis: 50,
    deep_analysis: 20,
    synthesis: 40,
  };

  const mockUsageList = [
    {
      mese: "2026-09",
      isCurrentMonth: true,
      totalTimeSavedMinutes: 360,
      ricerca: { count: 30, timeSavedMinutes: 300 },
      analisi: { count: 10, timeSavedMinutes: 300 },
      deepAnalysis: { count: 5, timeSavedMinutes: 300 },
      sintesi: { count: 8, timeSavedMinutes: 120 },
      interazioniCount: 42,
    },
    {
      mese: "2026-08",
      isCurrentMonth: false,
      totalTimeSavedMinutes: 180,
      ricerca: { count: 20, timeSavedMinutes: 200 },
      analisi: { count: 5, timeSavedMinutes: 150 },
      deepAnalysis: { count: 2, timeSavedMinutes: 120 },
      sintesi: { count: 4, timeSavedMinutes: 60 },
      interazioniCount: 15,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { uid: "usr_flv_2026" } });
  });

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <UserUsage />
      </MemoryRouter>
    );

  test("configura correttamente i metadati SEO (noIndex e path riservato)", () => {
    mockUseUsageData.mockReturnValue({
      usageList: mockUsageList,
      limits: defaultLimits,
      loading: false,
      error: null,
    });

    renderComponent();

    expect(mockSeo).toHaveBeenCalledTimes(1);
    expect(mockSeo).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Monitoraggio Utilizzi e Statistiche",
        path: "/profilo/utilizzi",
        noIndex: true,
      })
    );
  });

  test("renderizza lo stato di caricamento iniziale", () => {
    mockUseUsageData.mockReturnValue({
      usageList: [],
      limits: defaultLimits,
      loading: true,
      error: null,
    });

    renderComponent();

    expect(screen.getByText("Sincronizzazione registri...")).toBeInTheDocument();
  });

  test("renderizza il messaggio di errore in caso di fallimento della chiamata", () => {
    mockUseUsageData.mockReturnValue({
      usageList: [],
      limits: defaultLimits,
      loading: false,
      error: "Impossibile recuperare i log di utilizzo.",
    });

    renderComponent();

    expect(screen.getByText("Impossibile recuperare i log di utilizzo.")).toBeInTheDocument();
  });

  test("renderizza statistiche hero, card metriche e limiti per il mese corrente", () => {
    mockUseUsageData.mockReturnValue({
      usageList: mockUsageList,
      limits: defaultLimits,
      loading: false,
      error: null,
    });

    renderComponent();

    // Hero Section
    expect(screen.getByText(/Performance in corso/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: /Tempo Risparmiato/i })).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("ore")).toBeInTheDocument();

    // Card Metriche (titoli e conteggi)
    expect(screen.getByText("Ricerche")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText(/\/ 100/i)).toBeInTheDocument();

    expect(screen.getByText("Analisi Doc")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();

    expect(screen.getByText("Approfondimenti")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();

    expect(screen.getByText("Redazione")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();

    // Progress Bar aria attributes per il mese corrente
    const researchProgressBar = screen.getByRole("progressbar", { name: "Utilizzo Ricerche" });
    expect(researchProgressBar).toHaveAttribute("aria-valuenow", "30");
    expect(researchProgressBar).toHaveAttribute("aria-valuemax", "100");

    // Footer agente & metodologia
    expect(screen.getByText("42 interazioni")).toBeInTheDocument();
    expect(screen.getByText(/Base calcolo: Deep/i)).toBeInTheDocument();
  });

  test("permette di selezionare un mese storico e disattiva la visualizzazione dei limiti", () => {
    mockUseUsageData.mockReturnValue({
      usageList: mockUsageList,
      limits: defaultLimits,
      loading: false,
      error: null,
    });

    renderComponent();

    const select = screen.getByLabelText("Seleziona Mese");
    expect(select).toBeInTheDocument();

    // Cambia selezione al mese precedente (non corrente)
    fireEvent.change(select, { target: { value: "2026-08" } });

    expect(screen.getByText(/Performance storica/i)).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();

    // Nei mesi storici showLimit è false, quindi non devono comparire barre di avanzamento
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  test("gestisce lo stato 'Limite raggiunto' quando l'utilizzo eguaglia o supera il limite", () => {
    const exhaustedUsageList = [
      {
        ...mockUsageList[0],
        ricerca: { count: 100, timeSavedMinutes: 1000 },
      },
    ];

    mockUseUsageData.mockReturnValue({
      usageList: exhaustedUsageList,
      limits: defaultLimits,
      loading: false,
      error: null,
    });

    renderComponent();

    expect(screen.getByText("Limite raggiunto")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  test("naviga indietro al profilo al clic sul pulsante", () => {
    mockUseUsageData.mockReturnValue({
      usageList: mockUsageList,
      limits: defaultLimits,
      loading: false,
      error: null,
    });

    renderComponent();

    const backButton = screen.getByRole("button", { name: /torna al profilo/i });
    fireEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});