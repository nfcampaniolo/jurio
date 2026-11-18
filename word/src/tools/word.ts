/// <reference types="office-js" />

/**
 * Operazioni su Word condivise dagli strumenti. Nessuna modifica avviene senza un clic dell'utente.
 */

export const WORD_ONLY_MESSAGE =
  "Questa azione è disponibile solo all'interno del pannello di Microsoft Word.";

function assertWord(): void {
  if (typeof Word === "undefined" || !Word.run) throw new Error(WORD_ONLY_MESSAGE);
}

export async function readSelectionText(): Promise<string> {
  assertWord();
  return Word.run(async (context) => {
    const selection = context.document.getSelection();
    selection.load("text");
    await context.sync();
    return selection.text ?? "";
  });
}

export async function readDocumentText(): Promise<string> {
  assertWord();
  return Word.run(async (context) => {
    const body = context.document.body;
    body.load("text");
    await context.sync();
    return body.text ?? "";
  });
}

/** Inserisce la citazione subito dopo la selezione (non la sostituisce), con link alla scheda Jurio. */
export async function insertCitation(text: string, url?: string): Promise<void> {
  assertWord();
  await Word.run(async (context) => {
    const selection = context.document.getSelection();
    const range = selection.insertText(text, Word.InsertLocation.end);
    if (url) range.hyperlink = url;
    await context.sync();
  });
}

export function footnotesSupported(): boolean {
  try {
    return Boolean(Office?.context?.requirements?.isSetSupported("WordApi", "1.5"));
  } catch {
    return false;
  }
}

/** Nota a piè di pagina sulla selezione corrente (WordApi 1.5). */
export async function insertFootnote(text: string): Promise<void> {
  assertWord();
  if (!footnotesSupported()) {
    throw new Error(
      "Le note a piè di pagina richiedono una versione più recente di Word: usa il commento."
    );
  }
  await Word.run(async (context) => {
    context.document.getSelection().insertFootnote(text);
    await context.sync();
  });
}

export async function insertCommentOnSelection(text: string): Promise<void> {
  assertWord();
  await Word.run(async (context) => {
    context.document.getSelection().insertComment(text);
    await context.sync();
  });
}
