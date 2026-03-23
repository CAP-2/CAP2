"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const ai_controller_1 = require("../../../application/controllers/ai.controller");
const ai_vision_service_1 = require("../../../infrastructure/ai/ai.vision.service");
const ai_rag_service_1 = require("../../../infrastructure/ai/ai.rag.service");
const ai_db_agent_service_1 = require("../../../infrastructure/ai/ai.db_agent.service");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
const aiController = new ai_controller_1.AIController(new ai_vision_service_1.VisionService(), new ai_rag_service_1.RAGService(), new ai_db_agent_service_1.DBAgentService());
// DB Chat for structured MySQL queries
router.post("/db/chat", aiController.chatDb);
// Vision: image restoration + OCR only
router.post("/vision/restore-ocr", upload.single("image"), aiController.restoreAndOcr);
// Vision + RAG: full hybrid pipeline
router.post("/vision/restore-ocr-and-ingest", upload.single("image"), aiController.restoreOcrAndIngest);
// RAG ingestion (manual text)
router.post("/rag/ingest", aiController.ingestFamilyText);
// RAG chat
router.post("/rag/chat", aiController.chatHeritage);
exports.default = router;
