/// <reference types="office-js" />

import * as React from "react";
import { createRoot } from "react-dom/client";

import App from "./components/App";
import { purgeLegacyDocumentCache } from "../tools/memoryState";

// Le versioni precedenti salvavano il testo dei documenti nel localStorage: lo rimuoviamo all'avvio.
purgeLegacyDocumentCache();

const rootElement = document.getElementById("container");

if (!rootElement) {
  throw new Error("Elemento #container non trovato.");
}

const root = createRoot(rootElement);

Office.onReady(() => {
  root.render(<App />);
});
