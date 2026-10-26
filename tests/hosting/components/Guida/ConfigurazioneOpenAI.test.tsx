import { beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "react-hot-toast";
import ConfigurazioneOpenAI from "@/features/guide/components/ConfigurazioneOpenAI";

vi.mock("react-hot-toast", () => ({ toast: { success: vi.fn() } }));

describe("ConfigurazioneOpenAI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  test("mostra guida ChatGPT per configurare il server MCP", () => {
    render(<ConfigurazioneOpenAI />);
    expect(screen.getByRole("heading", { level: 1, name: "Connessione a ChatGPT" })).toBeInTheDocument();
    expect(screen.getByText("Integrazione ChatGPT")).toBeInTheDocument();
    expect(screen.getByText("Apri la sezione Plugin")).toBeInTheDocument();
    expect(screen.getByText("Parametri del connettore")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "2. Autorizzazione e verifica" })).toBeInTheDocument();
  });

  test("consente di copiare l'endpoint MCP Jurio", async () => {
    render(<ConfigurazioneOpenAI />);
    fireEvent.click(screen.getByRole("button", { name: /https:\/\/jurio\.it\/mcp/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://jurio.it/mcp"));
    expect(toast.success).toHaveBeenCalledWith("URL copiato negli appunti!");
  });

  test("include link esterno sicuro e contatti", () => {
    render(<ConfigurazioneOpenAI />);
    expect(screen.getByRole("link", { name: "https://chatgpt.com/" })).toHaveAttribute("href", "https://chatgpt.com/");
    expect(screen.getByRole("link", { name: "https://chatgpt.com/" })).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("link", { name: "/contatti" })).toHaveAttribute("href", "/contatti");
  });

  test("mostra i quattro segnaposto immagine nella cartella della guida", () => {
    render(<ConfigurazioneOpenAI />);
    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(4);
    expect(images.map((image) => image.getAttribute("src"))).toEqual([
      "/guida-image/open_ai_add.webp",
      "/guida-image/open_ai_config_1.webp",
      "/guida-image/open_ai_config_2.webp",
      "/guida-image/open_ai_config_3.webp",
    ]);
  });
});
