import { vi } from "vitest";

/**
 * Mock minimale di Office.js / Word API, sufficiente per i flussi usati dall'add-in:
 * lettura selezione/corpo, sostituzione testo, commenti, ricerca nel documento.
 */

// I mock sostituiscono i namespace globali di Office.js con oggetti parziali: tipizzazione volutamente lasca
const g = globalThis as unknown as Record<"Word" | "Office", unknown>;

export interface FakeRange {
  text: string;
  load: ReturnType<typeof vi.fn>;
  insertText: ReturnType<typeof vi.fn>;
  insertComment: ReturnType<typeof vi.fn>;
  insertFootnote: ReturnType<typeof vi.fn>;
  /** Range creati da insertText (per verificare ad es. il link di una citazione). */
  inserted: { hyperlink?: string }[];
}

function makeRange(text: string): FakeRange {
  const inserted: { hyperlink?: string }[] = [];
  return {
    text,
    load: vi.fn(),
    insertText: vi.fn(() => {
      const range = {};
      inserted.push(range);
      return range;
    }),
    insertComment: vi.fn(),
    insertFootnote: vi.fn(),
    inserted,
  };
}

export interface WordMock {
  selection: FakeRange;
  body: FakeRange & { search: ReturnType<typeof vi.fn>; insertParagraph: ReturnType<typeof vi.fn> };
  /** Range restituiti dalle ricerche, in ordine. */
  foundRanges: FakeRange[];
  run: ReturnType<typeof vi.fn>;
  sync: ReturnType<typeof vi.fn>;
}

const normalize = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

export function installWordMock(opts: { selectionText?: string; bodyText?: string } = {}): WordMock {
  const selection = makeRange(opts.selectionText ?? "");
  const foundRanges: FakeRange[] = [];
  const bodyRange = makeRange(opts.bodyText ?? "");

  const body = Object.assign(bodyRange, {
    insertParagraph: vi.fn(),
    // Simula `body.search(snippet, { matchCase:false, ignoreSpace:true })`
    search: vi.fn((snippet: string) => {
      const items = normalize(bodyRange.text).includes(normalize(snippet)) ? [makeRange(snippet)] : [];
      foundRanges.push(...items);
      return { items, load: vi.fn() };
    }),
  });

  const sync = vi.fn(async () => undefined);
  const context = { document: { getSelection: () => selection, body }, sync };
  const run = vi.fn(async (cb: (ctx: typeof context) => Promise<unknown>) => cb(context));

  g.Word = {
    run,
    InsertLocation: { replace: "Replace", end: "End", start: "Start" },
  };

  return { selection, body, foundRanges, run, sync };
}

export interface DialogMock {
  handlers: Record<string, (arg: unknown) => void>;
  close: ReturnType<typeof vi.fn>;
}

export function installOfficeMock(opts: { dialogFails?: boolean; withUi?: boolean } = {}) {
  const dialog: DialogMock = {
    handlers: {},
    close: vi.fn(),
  };
  const displayDialogAsync = vi.fn(
    (_url: string, _options: unknown, cb: (r: { status: string; value?: unknown }) => void) => {
      if (opts.dialogFails) {
        cb({ status: "failed" });
        return;
      }
      cb({
        status: "succeeded",
        value: {
          close: dialog.close,
          addEventHandler: (type: string, h: (arg: unknown) => void) => {
            dialog.handlers[type] = h;
          },
        },
      });
    }
  );

  g.Office = {
    onReady: vi.fn((cb?: () => void) => {
      cb?.();
      return Promise.resolve({ host: "Word", platform: "PC" });
    }),
    context: opts.withUi === false ? {} : { ui: { displayDialogAsync, messageParent: vi.fn() } },
    AsyncResultStatus: { Succeeded: "succeeded", Failed: "failed" },
    EventType: { DialogMessageReceived: "dialogMessageReceived", DialogEventReceived: "dialogEventReceived" },
  };

  return { dialog, displayDialogAsync };
}

export function uninstallOfficeMocks() {
  delete g.Word;
  delete g.Office;
}
