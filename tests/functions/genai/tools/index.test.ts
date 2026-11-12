import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  telemetry: vi.fn(),
  internal: { name: "internal" },
  distinguish: { name: "distinguish" },
  manual: { name: "manual" },
  file: { name: "file" },
  web: { name: "web" },
  doctrine: { name: "doctrine" },
  fullText: { name: "fullText" },
}));
vi.mock("../../../../functions/node_modules/@genkit-ai/firebase/lib/index.mjs", () => ({ enableFirebaseTelemetry: mocks.telemetry }));
vi.mock("@functions/genai/tools/internalDatabaseSearch", () => ({
  internalDatabaseSearch: mocks.internal, analyzeDistinguishingFacts: mocks.distinguish,
}));
vi.mock("@functions/genai/tools/support", () => ({ userManualSearch: mocks.manual }));
vi.mock("@functions/genai/tools/userFileSearch", () => ({ userFileSearch: mocks.file }));
vi.mock("@functions/genai/tools/webSearch", () => ({ webSearch: mocks.web, doctrineSearch: mocks.doctrine }));
vi.mock("@functions/genai/tools/readFullText", () => ({ readFullText: mocks.fullText }));

import { dynamicTools, internalDatabaseSearch, userFileSearch, userManualSearch, webSearch, doctrineSearch, analyzeDistinguishingFacts, readFullText } from "@functions/genai/tools/index";

describe("GenAI tool registry", () => {
  beforeEach(() => vi.clearAllMocks());

  it("enables telemetry and exposes the complete tool set in stable order", () => {
    expect(dynamicTools).toEqual([mocks.internal, mocks.file, mocks.web, mocks.doctrine, mocks.distinguish, mocks.manual, mocks.fullText]);
    expect([internalDatabaseSearch, userFileSearch, webSearch, doctrineSearch, analyzeDistinguishingFacts, userManualSearch, readFullText])
      .toEqual(dynamicTools);
  });
});
