"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIController = void 0;
class AIController {
    constructor(visionService, ragService, dbAgentService) {
        this.visionService = visionService;
        this.ragService = ragService;
        this.dbAgentService = dbAgentService;
        /**
         * POST /api/ai/db/chat
         * Body: { userId: string, question: string }
         *
         * Uses Gemini with SQL Tools to query or modify the database.
         */
        this.chatDb = async (req, res, _next) => {
            try {
                const { userId, question } = req.body;
                if (!userId || !question) {
                    return res.status(400).json({ message: "userId and question are required." });
                }
                const result = await this.dbAgentService.chatDb(userId, question);
                return res.status(200).json({
                    success: true,
                    data: result
                });
            }
            catch (error) {
                console.error("[AIController] chatDb error", error);
                return res.status(500).json({
                    success: false,
                    message: "Failed to answer DB question.",
                    details: error instanceof Error ? error.message : "Unknown error"
                });
            }
        };
        /**
         * POST /api/ai/vision/restore-ocr
         * Body: { imageUrl?: string }
         * Or file upload: multipart/form-data, field "image"
         */
        this.restoreAndOcr = async (req, res, _next) => {
            try {
                const imageUrl = req.body?.imageUrl;
                if (!imageUrl && !req.file) {
                    return res.status(400).json({
                        message: "Either imageUrl in body or image file upload is required."
                    });
                }
                const result = imageUrl
                    ? await this.visionService.processImageFromUrl(imageUrl)
                    : await this.visionService.processImageFromBuffer(req.file.buffer);
                return res.status(200).json({
                    success: true,
                    data: result
                });
            }
            catch (error) {
                console.error("[AIController] restoreAndOcr error", error);
                return res.status(500).json({
                    success: false,
                    message: "Failed to restore and OCR image.",
                    details: error instanceof Error ? error.message : "Unknown error"
                });
            }
        };
        /**
         * POST /api/ai/vision/restore-ocr-and-ingest
         * Body (JSON or multipart fields):
         *   - userId: string (required)
         *   - imageUrl?: string (optional if file provided)
         * File (multipart/form-data):
         *   - image: file buffer (optional if imageUrl provided)
         *
         * Flow:
         *   1. Vision: restoration + OCR (Vietnamese).
         *   2. RAG: ingest OCR text into Chroma for that user.
         *   3. Returns both OCR result and ingestion stats.
         */
        this.restoreOcrAndIngest = async (req, res, _next) => {
            try {
                const { userId } = req.body;
                const imageUrl = req.body?.imageUrl;
                if (!userId) {
                    return res.status(400).json({
                        message: "userId is required."
                    });
                }
                if (!imageUrl && !req.file) {
                    return res.status(400).json({
                        message: "Either imageUrl in body or image file upload (field 'image') is required."
                    });
                }
                // 1) Vision pipeline: restore + OCR
                const visionResult = imageUrl
                    ? await this.visionService.processImageFromUrl(imageUrl)
                    : await this.visionService.processImageFromBuffer(req.file.buffer);
                if (!visionResult.text || !visionResult.text.trim()) {
                    return res.status(200).json({
                        success: true,
                        message: "OCR completed but no readable text was detected to ingest into RAG.",
                        data: {
                            ocr: visionResult,
                            ingest: null
                        }
                    });
                }
                // 2) RAG ingest: store OCR text as family record for that user
                const ingestResult = await this.ragService.ingestFamilyText(userId, visionResult.text);
                return res.status(200).json({
                    success: true,
                    data: {
                        ocr: visionResult,
                        ingest: ingestResult
                    }
                });
            }
            catch (error) {
                console.error("[AIController] restoreOcrAndIngest error", error);
                return res.status(500).json({
                    success: false,
                    message: "Failed to process image and ingest family text.",
                    details: error instanceof Error ? error.message : "Unknown error"
                });
            }
        };
        /**
         * POST /api/ai/rag/ingest
         * Body: { userId: string, text: string }
         * Use this for manual ingestion (e.g. typed family stories).
         */
        this.ingestFamilyText = async (req, res, _next) => {
            try {
                const { userId, text } = req.body;
                if (!userId || !text) {
                    return res.status(400).json({
                        message: "userId and text are required."
                    });
                }
                const result = await this.ragService.ingestFamilyText(userId, text);
                return res.status(200).json({
                    success: true,
                    data: result
                });
            }
            catch (error) {
                console.error("[AIController] ingestFamilyText error", error);
                return res.status(500).json({
                    success: false,
                    message: "Failed to ingest family text.",
                    details: error instanceof Error ? error.message : "Unknown error"
                });
            }
        };
        /**
         * POST /api/ai/rag/chat
         * Body: { userId: string, question: string }
         *
         * Uses Gemini RAG chain over user-specific Chroma context.
         */
        this.chatHeritage = async (req, res, _next) => {
            try {
                const { userId, question } = req.body;
                if (!userId || !question) {
                    return res.status(400).json({
                        message: "userId and question are required."
                    });
                }
                const result = await this.ragService.chatAboutHeritage(userId, question);
                return res.status(200).json({
                    success: true,
                    data: result
                });
            }
            catch (error) {
                console.error("[AIController] chatHeritage error", error);
                return res.status(500).json({
                    success: false,
                    message: "Failed to answer heritage question.",
                    details: error instanceof Error ? error.message : "Unknown error"
                });
            }
        };
    }
}
exports.AIController = AIController;
