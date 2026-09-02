import { describe, test, expect, vi } from "vitest";

/* ---------- hoisted mocks ---------- */
const { mockHelpers, mockCore, mockFascicoli, mockChats } = vi.hoisted(() => ({
  mockHelpers: {
    sanitizeDocumentName: vi.fn(() => "sanitized_name"),
    DOCUMENTS_HELPER_FLAG: "HELPER_ACTIVE",
  },
  mockCore: {
    uploadDocumentCore: vi.fn(),
    getDocumentMetadata: vi.fn(),
    DOCUMENTS_CORE_FLAG: "CORE_ACTIVE",
  },
  mockFascicoli: {
    linkDocumentToFascicolo: vi.fn(),
    getFascicoloDocuments: vi.fn(),
    DOCUMENTS_FASCICOLI_FLAG: "FASCICOLI_ACTIVE",
  },
  mockChats: {
    attachDocumentToChat: vi.fn(),
    getDocumentChatThreads: vi.fn(),
    DOCUMENTS_CHATS_FLAG: "CHATS_ACTIVE",
  },
}));

/* ---------- mock modules ---------- */
vi.mock("./documentsHelpers", () => mockHelpers);
vi.mock("./documentsCore", () => mockCore);
vi.mock("./documentsFascicoli", () => mockFascicoli);
vi.mock("./documentsChats", () => mockChats);

vi.mock("@/services/documentsHelpers", () => mockHelpers);
vi.mock("@/services/documentsCore", () => mockCore);
vi.mock("@/services/documentsFascicoli", () => mockFascicoli);
vi.mock("@/services/documentsChats", () => mockChats);

/* ---------- subject under test ---------- */
import * as DocumentsService from "@/services/document";

describe("Documents Barrel Export Suite", () => {
  test("riesporta correttamente tutti i membri da documentsHelpers", () => {
    expect(DocumentsService).toHaveProperty("sanitizeDocumentName", mockHelpers.sanitizeDocumentName);
    expect(DocumentsService).toHaveProperty("DOCUMENTS_HELPER_FLAG", "HELPER_ACTIVE");
  });

  test("riesporta correttamente tutti i membri da documentsCore", () => {
    expect(DocumentsService).toHaveProperty("uploadDocumentCore", mockCore.uploadDocumentCore);
    expect(DocumentsService).toHaveProperty("getDocumentMetadata", mockCore.getDocumentMetadata);
    expect(DocumentsService).toHaveProperty("DOCUMENTS_CORE_FLAG", "CORE_ACTIVE");
  });

  test("riesporta correttamente tutti i membri da documentsFascicoli", () => {
    expect(DocumentsService).toHaveProperty("linkDocumentToFascicolo", mockFascicoli.linkDocumentToFascicolo);
    expect(DocumentsService).toHaveProperty("getFascicoloDocuments", mockFascicoli.getFascicoloDocuments);
    expect(DocumentsService).toHaveProperty("DOCUMENTS_FASCICOLI_FLAG", "FASCICOLI_ACTIVE");
  });

  test("riesporta correttamente tutti i membri da documentsChats", () => {
    expect(DocumentsService).toHaveProperty("attachDocumentToChat", mockChats.attachDocumentToChat);
    expect(DocumentsService).toHaveProperty("getDocumentChatThreads", mockChats.getDocumentChatThreads);
    expect(DocumentsService).toHaveProperty("DOCUMENTS_CHATS_FLAG", "CHATS_ACTIVE");
  });

  test("non contiene export indefiniti o risoluzioni parziali", () => {
    const exportedKeys = Object.keys(DocumentsService);

    expect(exportedKeys.length).toBeGreaterThanOrEqual(8);

    for (const key of exportedKeys) {
      const value = (DocumentsService as Record<string, unknown>)[key];
      expect(value).toBeDefined();
    }
  });
});