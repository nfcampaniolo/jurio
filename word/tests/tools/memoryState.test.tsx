import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  clearMemoryState,
  LEGACY_DOCUMENT_KEYS,
  purgeLegacyDocumentCache,
  readMemoryState,
  useMemoryState,
} from "@word/tools/memoryState";

const Campo = () => {
  const [v, setV] = useMemoryState("k", "");
  return <input aria-label="campo" value={v} onChange={(e) => setV(e.target.value)} />;
};

describe("stato in memoria degli strumenti", () => {
  it("sopravvive allo smontaggio del componente ma non tocca il localStorage", () => {
    const { unmount } = render(<Campo />);
    fireEvent.change(screen.getByLabelText("campo"), { target: { value: "testo riservato" } });
    unmount();
    render(<Campo />);
    expect(screen.getByLabelText("campo")).toHaveValue("testo riservato");
    expect(localStorage.length).toBe(0);
  });

  it("clearMemoryState azzera tutto", () => {
    render(<Campo />);
    fireEvent.change(screen.getByLabelText("campo"), { target: { value: "x" } });
    clearMemoryState();
    expect(readMemoryState("k")).toBeUndefined();
  });

  it("purgeLegacyDocumentCache rimuove solo le chiavi delle versioni precedenti", () => {
    LEGACY_DOCUMENT_KEYS.forEach((k) => localStorage.setItem(k, "vecchio"));
    localStorage.setItem("preferenza", "tema");
    purgeLegacyDocumentCache();
    LEGACY_DOCUMENT_KEYS.forEach((k) => expect(localStorage.getItem(k)).toBeNull());
    expect(localStorage.getItem("preferenza")).toBe("tema");
  });
});
