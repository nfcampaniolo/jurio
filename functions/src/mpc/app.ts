import express from "express";
import helmet from "helmet";
import cors from "cors";
import { corsOptions } from "./config/cors";
import { metadataRouter } from "./routes/metadata.routes";
import { oauthRouter } from "./routes/oauth.routes";
import { mcpRouter } from "./routes/mcp.routes";

export const app = express();

// 1. Hardening Header e Limite Payload
app.use(helmet());
app.use(express.json({ limit: "10kb" }));

// 2. CORS Restrittivo
app.use(cors(corsOptions));

// 3. Normalizzazione URL: rimuove il prefisso /mcp se presente
app.use((req, res, next) => {
  if (req.url.startsWith("/mcp/")) {
    req.url = req.url.replace(/^\/mcp/, "");
  } else if (req.url === "/mcp") {
    req.url = "/";
  }
  next();
});

// 4. Moduli Applicativi
app.use(metadataRouter);
app.use(oauthRouter);
app.use(mcpRouter);

// 5. Fallback 404 per rotte non gestite
app.use((req, res) => {
  res.status(404).json({ error: "not_found", message: "Endpoint non trovato." });
});