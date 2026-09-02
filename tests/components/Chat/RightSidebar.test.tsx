import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

/* ---------- mock firebase ---------- */
vi.mock("firebase/app", () => ({
  getApp: () => ({}),
  initializeApp: () => ({}),
}));

vi.mock("firebase/auth", () => ({
  getAuth: () => ({ currentUser: { uid: "test-user-id" } }),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: () => ({}),
  doc: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  Timestamp: { now: () => ({ toDate: () => new Date() }) },
}));

/* ---------- mock subcomponents via alias ---------- */
interface CaseMetadataMockProps {
  activeFascicoloId?: string;
  initialMetadati: Record<string, string>;
  isReadOnly?: boolean;
}

vi.mock("@/components/Chat/CaseMetadataSection", () => ({
  CaseMetadataSection: ({
    activeFascicoloId,
    initialMetadati,
    isReadOnly,
  }: CaseMetadataMockProps) => (
    <div
      data-testid="case-metadata-section"
      data-fascicolo-id={activeFascicoloId || ""}
      data-readonly={isReadOnly ? "true" : "false"}
      data-metadati-keys={Object.keys(initialMetadati || {}).join(",")}
    >
      CaseMetadataSection Mock
    </div>
  ),
}));

interface ThreadSectionMockProps {
  threads: Array<{ id: string; title: string }>;
  activeThreadId?: string;
  activeFascicoloId?: string;
  onThreadSelect?: (id: string) => void;
  onNewThread?: () => void;
  onDeleteThread?: (fascicoloId: string, threadId: string) => void;
  isReadOnly?: boolean;
}

vi.mock("@/components/Chat/ThreadSection", () => ({
  ThreadSection: ({
    threads = [],
    activeThreadId,
    activeFascicoloId,
    onThreadSelect,
    onNewThread,
    onDeleteThread,
    isReadOnly,
  }: ThreadSectionMockProps) => (
    <div
      data-testid="thread-section"
      data-threads-count={threads.length}
      data-active-thread={activeThreadId || ""}
      data-fascicolo-id={activeFascicoloId || ""}
      data-readonly={isReadOnly ? "true" : "false"}
    >
      <button data-testid="thread-select-btn" onClick={() => onThreadSelect?.("thread-selected-1")}>
        Select Thread
      </button>
      <button data-testid="new-thread-btn" onClick={() => onNewThread?.()}>
        New Thread
      </button>
      <button
        data-testid="delete-thread-btn"
        onClick={() => onDeleteThread?.(activeFascicoloId || "", "thread-to-delete")}
      >
        Delete Thread
      </button>
    </div>
  ),
}));

interface SourcesSectionMockProps {
  messages: Array<{ id: string }>;
  activeSourceId: string | undefined | null;
  setActiveSourceId: (id: string | null) => void;
  onSourceClick?: (e: React.MouseEvent, source: { id: string }) => void;
}

vi.mock("@/components/Chat/SourcesSection", () => ({
  SourcesSection: ({
    messages = [],
    activeSourceId,
    setActiveSourceId,
    onSourceClick,
  }: SourcesSectionMockProps) => (
    <div
      data-testid="sources-section"
      data-messages-count={messages.length}
      data-active-source={activeSourceId || ""}
    >
      <button data-testid="set-source-btn" onClick={() => setActiveSourceId("src-active-1")}>
        Set Source
      </button>
      <button
        data-testid="click-source-btn"
        onClick={(e) => onSourceClick?.(e, { id: "clicked-src" } as unknown as { id: string })}
      >
        Click Source
      </button>
    </div>
  ),
}));

/* ---------- component ---------- */
import { RightSidebar } from "@/components/Chat/RightSidebar";
import type { Message, Source, ThreadItem } from "@/interfaces/interfaces";

describe("RightSidebar Component Suite", () => {
  const mockSetActiveSourceId = vi.fn();
  const mockOnThreadSelect = vi.fn();
  const mockOnNewThread = vi.fn();
  const mockOnSourceClick = vi.fn();
  const mockOnDeleteThread = vi.fn();
  const mockRemoveAttachment = vi.fn();
  const mockOnOpenDocsPanel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "Test", "/fascicolo/fasc-12345/thread-67890");
  });

  const defaultProps = {
    sessionType: "fascicolo" as const,
    attachedDocs: [],
    removeAttachment: mockRemoveAttachment,
    onOpenDocsPanel: mockOnOpenDocsPanel,
    messages: [{ id: "msg-1" }] as Message[],
    activeSourceId: null,
    setActiveSourceId: mockSetActiveSourceId,
    threads: [{ id: "thread-1", title: "Thread Uno" }] as ThreadItem[],
    activeThreadId: "thread-1",
    onThreadSelect: mockOnThreadSelect,
    onNewThread: mockOnNewThread,
    onSourceClick: mockOnSourceClick,
    onDeleteThread: mockOnDeleteThread,
    metadati: { Giudice: "Dott. Bianchi" },
    isReadOnly: false,
  };

  test("renderizza tutte le sezioni (CaseMetadata, Thread, Sources) per sessionType = 'fascicolo'", () => {
    render(<RightSidebar {...defaultProps} />);

    // CaseMetadataSection
    const metadataSection = screen.getByTestId("case-metadata-section");
    expect(metadataSection).toBeInTheDocument();
    expect(metadataSection).toHaveAttribute("data-fascicolo-id", "fasc-12345");
    expect(metadataSection).toHaveAttribute("data-readonly", "false");
    expect(metadataSection).toHaveAttribute("data-metadati-keys", "Giudice");

    // ThreadSection
    const threadSection = screen.getByTestId("thread-section");
    expect(threadSection).toBeInTheDocument();
    expect(threadSection).toHaveAttribute("data-threads-count", "1");
    expect(threadSection).toHaveAttribute("data-active-thread", "thread-1");
    expect(threadSection).toHaveAttribute("data-fascicolo-id", "fasc-12345");
    expect(threadSection).toHaveAttribute("data-readonly", "false");

    // SourcesSection
    const sourcesSection = screen.getByTestId("sources-section");
    expect(sourcesSection).toBeInTheDocument();
    expect(sourcesSection).toHaveAttribute("data-messages-count", "1");
  });

  test("non renderizza CaseMetadataSection e ThreadSection quando sessionType !== 'fascicolo'", () => {
    render(
      <RightSidebar
        {...defaultProps}
        sessionType="temporanea"
      />
    );

    expect(screen.queryByTestId("case-metadata-section")).not.toBeInTheDocument();
    expect(screen.queryByTestId("thread-section")).not.toBeInTheDocument();

    // SourcesSection rimane sempre renderizzata
    expect(screen.getByTestId("sources-section")).toBeInTheDocument();
  });

  test("inoltra la modalità isReadOnly a CaseMetadataSection e ThreadSection", () => {
    render(
      <RightSidebar
        {...defaultProps}
        isReadOnly={true}
      />
    );

    expect(screen.getByTestId("case-metadata-section")).toHaveAttribute("data-readonly", "true");
    expect(screen.getByTestId("thread-section")).toHaveAttribute("data-readonly", "true");
  });

  test("estrae correttamente activeFascicoloId dall'URL e gestisce fallback di default", () => {
    // URL senza ID fascicolo
    window.history.pushState({}, "Test", "/chat");

    render(
      <RightSidebar
        sessionType="fascicolo"
        attachedDocs={[]}
        removeAttachment={mockRemoveAttachment}
        onOpenDocsPanel={mockOnOpenDocsPanel}
        messages={[]}
        activeSourceId={undefined}
        setActiveSourceId={mockSetActiveSourceId}
      />
    );

    const metadataSection = screen.getByTestId("case-metadata-section");
    expect(metadataSection).toHaveAttribute("data-fascicolo-id", "");
    expect(metadataSection).toHaveAttribute("data-metadati-keys", "");

    const threadSection = screen.getByTestId("thread-section");
    expect(threadSection).toHaveAttribute("data-threads-count", "0");
    expect(threadSection).toHaveAttribute("data-readonly", "false");
  });

  test("collega correttamente le callback delle sotto-sezioni (Thread e Sources)", () => {
    render(<RightSidebar {...defaultProps} />);

    // Azioni ThreadSection
    fireEvent.click(screen.getByTestId("thread-select-btn"));
    expect(mockOnThreadSelect).toHaveBeenCalledWith("thread-selected-1");

    fireEvent.click(screen.getByTestId("new-thread-btn"));
    expect(mockOnNewThread).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("delete-thread-btn"));
    expect(mockOnDeleteThread).toHaveBeenCalledWith("fasc-12345", "thread-to-delete");

    // Azioni SourcesSection
    fireEvent.click(screen.getByTestId("set-source-btn"));
    expect(mockSetActiveSourceId).toHaveBeenCalledWith("src-active-1");

    fireEvent.click(screen.getByTestId("click-source-btn"));
    expect(mockOnSourceClick).toHaveBeenCalledWith(expect.anything(), { id: "clicked-src" } as Source);
  });
});