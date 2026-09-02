import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

/* ---------- component ---------- */
import { SupportSidebar } from "@/components/Info/SupportSidebar"; // <-- adegua il path se necessario

type IdleCallback = (cb: () => void, opts?: { timeout: number }) => number;
type CancelIdleCallback = (id: number) => void;

type CustomWindow = Omit<Window, "requestIdleCallback" | "cancelIdleCallback"> & {
  requestIdleCallback?: IdleCallback;
  cancelIdleCallback?: CancelIdleCallback;
};

describe("SupportSidebar Component Suite", () => {
  const customWindow = window as unknown as CustomWindow;
  const originalRequestIdleCallback = customWindow.requestIdleCallback;
  const originalCancelIdleCallback = customWindow.cancelIdleCallback;

  let playMock: ReturnType<typeof vi.fn<() => Promise<void>>>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    playMock = vi.fn<() => Promise<void>>().mockImplementation(() => Promise.resolve());
    window.HTMLMediaElement.prototype.play = playMock;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    customWindow.requestIdleCallback = originalRequestIdleCallback;
    customWindow.cancelIdleCallback = originalCancelIdleCallback;
    vi.restoreAllMocks();
  });

  test("renderizza la sidebar con la gerarchia semantica corretta, badge e traccia video accessibile", () => {
    const { container } = render(<SupportSidebar />);

    const asideElement = screen.getByRole("complementary");
    expect(asideElement).toBeInTheDocument();

    const h2 = screen.getByRole("heading", { name: "Canali diretti", level: 2 });
    expect(h2).toBeInTheDocument();

    const h3 = screen.getByRole("heading", { name: "Chiedi a Jurio AI", level: 3 });
    expect(h3).toBeInTheDocument();

    expect(screen.getByText("AI Online")).toBeInTheDocument();

    expect(
      screen.getByText(
        /Il nostro assistente basato su intelligenza artificiale può risolvere i tuoi dubbi/i
      )
    ).toBeInTheDocument();

    const video = container.querySelector("video");
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute("poster", "/demo2.webp");
    expect(video).toHaveAttribute("preload", "none");
    expect(video).toHaveAttribute("aria-hidden", "true");
    expect(video).not.toHaveAttribute("src");

    const track = container.querySelector("track");
    expect(track).toBeInTheDocument();
    expect(track).toHaveAttribute("kind", "captions");
    expect(track).toHaveAttribute("srclang", "it");
    expect(track).toHaveAttribute("label", "Video dimostrativo (Muto)");
  });

  test("carica e riproduce il video tramite requestIdleCallback quando disponibile", () => {
    let capturedCallback: (() => void) | undefined;
    const mockRequestIdleCallback = vi.fn<IdleCallback>((cb) => {
      capturedCallback = cb;
      return 42;
    });

    customWindow.requestIdleCallback = mockRequestIdleCallback;

    const { container } = render(<SupportSidebar />);

    expect(mockRequestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 2500 });

    const video = container.querySelector("video");
    expect(video).not.toHaveAttribute("src");

    act(() => {
      capturedCallback?.();
    });

    expect(video).toHaveAttribute("src", "/demo2.mp4");
    expect(video).toHaveProperty("autoplay", true);
    expect(playMock).toHaveBeenCalledTimes(1);
  });

  test("esegue cancelIdleCallback se il componente viene smontato prima dell'esecuzione", () => {
    const mockCancelIdleCallback = vi.fn<CancelIdleCallback>();
    customWindow.requestIdleCallback = vi.fn<IdleCallback>(() => 99);
    customWindow.cancelIdleCallback = mockCancelIdleCallback;

    const { unmount } = render(<SupportSidebar />);

    unmount();

    expect(mockCancelIdleCallback).toHaveBeenCalledWith(99);
  });

  test("utilizza il fallback setTimeout quando requestIdleCallback non è supportato", () => {
    delete customWindow.requestIdleCallback;
    delete customWindow.cancelIdleCallback;

    const { container } = render(<SupportSidebar />);

    const video = container.querySelector("video");
    expect(video).not.toHaveAttribute("src");

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(video).toHaveAttribute("src", "/demo2.mp4");
    expect(video).toHaveProperty("autoplay", true);
    expect(playMock).toHaveBeenCalledTimes(1);
  });

  test("esegue clearTimeout nel fallback se il componente viene smontato prima del timeout", () => {
    delete customWindow.requestIdleCallback;
    delete customWindow.cancelIdleCallback;

    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");

    const { unmount } = render(<SupportSidebar />);

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  test("gestisce il rifiuto della promise play() del video senza sollevare eccezioni non gestite", () => {
    playMock.mockRejectedValueOnce(new Error("Autoplay not allowed"));
    delete customWindow.requestIdleCallback;

    render(<SupportSidebar />);

    expect(() => {
      act(() => {
        vi.advanceTimersByTime(2000);
      });
    }).not.toThrow();
  });
});