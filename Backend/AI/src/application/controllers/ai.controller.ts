import { Request, Response, NextFunction } from "express";
import { VisionService } from "../../infrastructure/ai/ai.vision.service";
import { RAGService } from "../../infrastructure/ai/ai.rag.service";
import { DBAgentService } from "../../infrastructure/ai/ai.db_agent.service";

export class AIController {
  constructor(
    private readonly visionService: VisionService,
    private readonly ragService: RAGService,
    private readonly dbAgentService: DBAgentService
  ) {}

  /**
   * POST /api/ai/db/chat
   * Body: { userId: string, question: string }
   * 
   * Uses Gemini with SQL Tools to query or modify the database.
   */
  chatDb = async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { userId, question } = req.body as { userId?: string; question?: string; };
      if (!userId || !question) {
        return res.status(400).json({ message: "userId and question are required." });
      }

      const result = await this.dbAgentService.chatDb(userId, question);

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error: any) {
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
  restoreAndOcr = async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const imageUrl: string | undefined = req.body?.imageUrl;

      if (!imageUrl && !req.file) {
        return res.status(400).json({
          message: "Either imageUrl in body or image file upload is required."
        });
      }

      const result = imageUrl
        ? await this.visionService.processImageFromUrl(imageUrl)
        : await this.visionService.processImageFromBuffer(
            req.file!.buffer as Buffer
          );

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error: any) {
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
  restoreOcrAndIngest = async (
    req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    try {
      const { userId } = req.body as { userId?: string; imageUrl?: string };
      const imageUrl: string | undefined = req.body?.imageUrl;

      if (!userId) {
        return res.status(400).json({
          message: "userId is required."
        });
      }

      if (!imageUrl && !req.file) {
        return res.status(400).json({
          message:
            "Either imageUrl in body or image file upload (field 'image') is required."
        });
      }

      // 1) Vision pipeline: restore + OCR
      const visionResult = imageUrl
        ? await this.visionService.processImageFromUrl(imageUrl)
        : await this.visionService.processImageFromBuffer(
            req.file!.buffer as Buffer
          );

      if (!visionResult.text || !visionResult.text.trim()) {
        return res.status(200).json({
          success: true,
          message:
            "OCR completed but no readable text was detected to ingest into RAG.",
          data: {
            ocr: visionResult,
            ingest: null
          }
        });
      }

      // 2) RAG ingest: store OCR text as family record for that user
      const ingestResult = await this.ragService.ingestFamilyText(
        userId,
        visionResult.text
      );

      return res.status(200).json({
        success: true,
        data: {
          ocr: visionResult,
          ingest: ingestResult
        }
      });
    } catch (error: any) {
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
  ingestFamilyText = async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { userId, text } = req.body as {
        userId?: string;
        text?: string;
      };

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
    } catch (error: any) {
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
  chatHeritage = async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { userId, question } = req.body as {
        userId?: string;
        question?: string;
      };

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
    } catch (error: any) {
      console.error("[AIController] chatHeritage error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to answer heritage question.",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };
}