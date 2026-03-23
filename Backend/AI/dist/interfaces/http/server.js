"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const ai_routes_1 = __importDefault(require("./routes/ai.routes"));
const env_1 = require("../../config/env");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: "10mb" }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use("/api/ai", ai_routes_1.default);
// Simple health check
app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "gen-link-backend" });
});
app.use((err, _req, res, _next) => {
    console.error("[GlobalError]", err);
    res.status(500).json({
        success: false,
        message: "Internal server error.",
        details: err instanceof Error ? err.message : "Unknown error"
    });
});
app.listen(env_1.env.port, () => {
    console.log(`GEN-LINK backend listening on port ${env_1.env.port}`);
});
