"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.env = {
    port: Number(process.env.PORT) || 4000,
    geminiApiKey: process.env.GEMINI_API_KEY || "",
    hfApiKey: process.env.HF_API_KEY || "",
    hfRestorationModel: process.env.HF_RESTORATION_MODEL || "caidas/swin2SR-classical-sr-x4-64",
    chromaUrl: process.env.CHROMA_URL || "http://localhost:8000",
    dbHost: process.env.DB_HOST || "",
    dbPort: Number(process.env.DB_PORT) || 3306,
    dbUser: process.env.DB_USER || "",
    dbPassword: process.env.DB_PASSWORD || "",
    dbName: process.env.DB_NAME || ""
};
if (!exports.env.geminiApiKey) {
    console.warn("Warning: GEMINI_API_KEY is not set.");
}
if (!exports.env.hfApiKey) {
    console.warn("Warning: HF_API_KEY is not set.");
}
