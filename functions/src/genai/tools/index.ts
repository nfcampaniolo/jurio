import { internalDatabaseSearch, analyzeDistinguishingFacts } from "./internalDatabaseSearch";
import { userManualSearch } from "./support";
import { userFileSearch } from "./userFileSearch";
import { webSearch, doctrineSearch } from "./webSearch";
import { readFullText } from "./readFullText";
import { enableFirebaseTelemetry } from "@genkit-ai/firebase";

void enableFirebaseTelemetry();

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