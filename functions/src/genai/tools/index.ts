import { internalDatabaseSearch, analyzeDistinguishingFacts } from "./internalDatabaseSearch";
import { userManualSearch } from "./support";
import { userFileSearch } from "./userFileSearch";
import { webSearch, doctrineSearch } from "./webSearch";
import { enableFirebaseTelemetry } from "@genkit-ai/firebase";

enableFirebaseTelemetry();

export const dynamicTools = [
  internalDatabaseSearch,
  userFileSearch,
  webSearch,
  doctrineSearch,
  analyzeDistinguishingFacts,
  userManualSearch,
];

export { userFileSearch };
export { internalDatabaseSearch };
export { webSearch };
export { doctrineSearch };
export { analyzeDistinguishingFacts };
export { userManualSearch };