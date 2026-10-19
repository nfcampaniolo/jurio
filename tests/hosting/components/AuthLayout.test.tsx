import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthLayout } from "@/features/auth/components/AuthLayout"; // Adatta il path in base alla struttura del tuo progetto

// Mock opzionale di framer-motion se si desidera bypassare il motore di animazione nei test dei componenti
vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return {
    ...actual,
    motion: {
      div: ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <div className={className}>{children}</div>
      ),
    },
  };
});

describe("AuthLayout Component Suite", () => {
  test("renderizza correttamente la struttura base con l'immagine di login e i children", () => {
    render(
      <AuthLayout>
        <div data-testid="test-child-form">Form di autenticazione</div>
      </AuthLayout>
    );

    // Verifica la presenza dell'immagine e del form iniettato
    const image = screen.getByRole("img", { name: /login illustration/i });
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute("src", "/login.webp");

    expect(screen.getByTestId("test-child-form")).toBeInTheDocument();
    expect(screen.getByText("Form di autenticazione")).toBeInTheDocument();
  });

  test("renderizza titolo e sottotitolo quando vengono passati come props", () => {
    render(
      <AuthLayout title="Bentornato in Jurio" subtitle="Accedi per consultare i documenti">
        <p>Contenuto interno</p>
      </AuthLayout>
    );

    expect(screen.getByRole("heading", { level: 1, name: "Bentornato in Jurio" })).toBeInTheDocument();
    expect(screen.getByText("Accedi per consultare i documenti")).toBeInTheDocument();
  });

  test("non renderizza il blocco dell'intestazione se title e subtitle non vengono passati", () => {
    render(
      <AuthLayout>
        <p>Solo contenuto</p>
      </AuthLayout>
    );

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});