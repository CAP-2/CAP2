import { Router } from "express";
import multer from "multer";
import { AIController } from "../../../application/controllers/ai.controller";
import { VisionService } from "../../../infrastructure/ai/ai.vision.service";
import { RAGService } from "../../../infrastructure/ai/ai.rag.service";
import { DBAgentService } from "../../../infrastructure/ai/ai.db_agent.service";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const aiController = new AIController(
  new VisionService(), 
  new RAGService(),
  new DBAgentService()
);

// DB Chat for structured MySQL queries
router.post("/db/chat", aiController.chatDb);


// Vision: image restoration + OCR only
router.post(
  "/vision/restore-ocr",
  upload.single("image"),
  aiController.restoreAndOcr
);

// Vision + RAG: full hybrid pipeline
router.post(
  "/vision/restore-ocr-and-ingest",
  upload.single("image"),
  aiController.restoreOcrAndIngest
);

// RAG ingestion (manual text)
router.post("/rag/ingest", aiController.ingestFamilyText);

// RAG chat
router.post("/rag/chat", aiController.chatHeritage);

export default router;