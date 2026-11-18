import { describe, expect, it } from "vitest";
import {
  footnotesSupported,
  insertCitation,
  insertFootnote,
  readDocumentText,
  readSelectionText,
  WORD_ONLY_MESSAGE,
} from "@word/tools/word";
import { installWordMock, uninstallOfficeMocks } from "../mocks/office";

const setRequirements = (supported: boolean) => {
  const office = (globalThis as unknown as { Office: Record<string, unknown> }).Office;
  office.context = { ...(office.context as object), requirements: { isSetSupported: () => supported } };
};

describe("operazioni su Word", () => {
  it("legge selezione e documento", async () => {
    installWordMock({ selectionText: "sel", bodyText: "corpo" });
    await expect(readSelectionText()).resolves.toBe("sel");
    await expect(readDocumentText()).resolves.toBe("corpo");
  });

  it("la citazione va dopo la selezione e senza URL non crea link", async () => {
    const word = installWordMock();
    await insertCitation("Cass. 1/2020");
    expect(word.selection.insertText).toHaveBeenCalledWith("Cass. 1/2020", "End");
    expect(word.selection.inserted[0].hyperlink).toBeUndefined();
  });

  it("note a piè di pagina solo se Word supporta WordApi 1.5", async () => {
    const word = installWordMock();
    setRequirements(false);
    expect(footnotesSupported()).toBe(false);
    await expect(insertFootnote("nota")).rejects.toThrow(/versione più recente di Word/);
    setRequirements(true);
    await insertFootnote("nota");
    expect(word.selection.insertFootnote).toHaveBeenCalledWith("nota");
  });

  it("fuori da Word lancia un messaggio chiaro", async () => {
    uninstallOfficeMocks();
    await expect(readSelectionText()).rejects.toThrow(WORD_ONLY_MESSAGE);
  });
});
