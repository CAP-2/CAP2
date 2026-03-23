import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT) || 4000,
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  hfApiKey: process.env.HF_API_KEY || "",
  hfRestorationModel:
    process.env.HF_RESTORATION_MODEL || "caidas/swin2SR-classical-sr-x4-64",
  chromaUrl: process.env.CHROMA_URL || "http://localhost:8000",
  dbHost: process.env.DB_HOST || "",
  dbPort: Number(process.env.DB_PORT) || 3306,
  dbUser: process.env.DB_USER || "",
  dbPassword: process.env.DB_PASSWORD || "",
  dbName: process.env.DB_NAME || ""
};

if (!env.geminiApiKey) {
  console.warn("Warning: GEMINI_API_KEY is not set.");
}
if (!env.hfApiKey) {
  console.warn("Warning: HF_API_KEY is not set.");
}