import { internalDatabaseSearch, analyzeDistinguishingFacts } from "./internalDatabaseSearch";
import { userManualSearch } from "./support";
import { userFileSearch } from "./userFileSearch";
import { webSearch, doctrineSearch } from "./webSearch";
import { readFullText } from "./readFullText";
import { enableFirebaseTelemetry } from "@genkit-ai/firebase";

// Metriche e tracce restano attive, ma senza il contenuto di input e output: i testi degli utenti
// (atti, contratti, documenti dei fascicoli) non devono finire in Cloud Logging / Cloud Trace.
void enableFirebaseTelemetry({ disableLoggingInputAndOutput: true });

export const dynamicTools = [
  internalDatabaseSearch,
  userFileSearch,
  webSearch,
  doctrineSearch,
  analyzeDistinguishingFacts,
  userManualSearch,
  readFullText,
];

export { userFileSearch };
export { internalDatabaseSearch };
export { webSearch };
export { doctrineSearch };
export { analyzeDistinguishingFacts };
export { userManualSearch };
export { readFullText };