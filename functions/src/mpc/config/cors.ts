import { CorsOptions } from "cors";

const ALLOWED_ORIGINS = [
  "https://jurio.it",
  "https://claude.ai",
  "https://chat.openai.com",
  "https://chat.mistral.ai",
];

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Origine non consentita dalle policy CORS di Jurio"));
    }
  },
  credentials: true,
};