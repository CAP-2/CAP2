"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisionService = void 0;
const axios_1 = __importDefault(require("axios"));
const tesseract_js_1 = __importDefault(require("tesseract.js"));
const env_1 = require("../../config/env");
class VisionService {
    constructor() {
        if (!env_1.env.hfApiKey) {
            throw new Error("HF_API_KEY is required for VisionService");
        }
        this.hfApiKey = env_1.env.hfApiKey;
        this.hfModel = env_1.env.hfRestorationModel;
    }
    /**
     * Downloads an image from a URL into a Buffer.
     */
    async downloadImage(url) {
        try {
            const response = await axios_1.default.get(encodeURI(url), {
                responseType: "arraybuffer",
                timeout: 15000
            });
            return Buffer.from(response.data);
        }
        catch (error) {
            console.error("[VisionService] Failed to download image", error);
            throw new Error("Failed to download image from provided URL.");
        }
    }
    /**
     * Calls Hugging Face Inference API with a local image buffer to perform restoration/enhancement.
     * Uses a generic image-to-image model; adjust model name via HF_RESTORATION_MODEL.
     */
    async restoreImageWithHuggingFace(imageBuffer) {
        const url = `https://api-inference.huggingface.co/models/${this.hfModel}`;
        try {
            const response = await axios_1.default.post(url, imageBuffer, {
                headers: {
                    Authorization: `Bearer ${this.hfApiKey}`,
                    "Content-Type": "application/octet-stream"
                },
                responseType: "arraybuffer",
                timeout: 60000
            });
            return Buffer.from(response.data);
        }
        catch (error) {
            console.error("[VisionService] HF restoration error", error?.response?.data);
            // If restoration fails, we can fall back to the original image;
            // here we rethrow so the caller can decide behavior.
            throw new Error(`Failed to restore image via Hugging Face: ${error?.response?.statusText || "Unknown error"}`);
        }
    }
    /**
     * Runs Tesseract OCR on an image buffer using Vietnamese language (vie).
     */
    async runOcr(imageBuffer) {
        try {
            const { data } = await tesseract_js_1.default.recognize(imageBuffer, "vie", {
                logger: () => {
                    // You can log progress here if needed
                }
            });
            const avgConfidence = data.words && data.words.length
                ? data.words.reduce((sum, w) => sum + (w.confidence || 0), 0) /
                    data.words.length
                : undefined;
            return {
                text: data.text?.trim() || "",
                language: "vie",
                confidence: avgConfidence
            };
        }
        catch (error) {
            console.error("[VisionService] OCR error", error);
            throw new Error("Failed to perform OCR on the image.");
        }
    }
    /**
     * End-to-end: download, restore, OCR for image URL.
     */
    async processImageFromUrl(imageUrl) {
        if (!imageUrl) {
            throw new Error("imageUrl is required.");
        }
        const originalBuffer = await this.downloadImage(imageUrl);
        let restoredBuffer = null;
        try {
            restoredBuffer = await this.restoreImageWithHuggingFace(originalBuffer);
        }
        catch (error) {
            // Log and gracefully fall back to original for OCR
            console.warn("[VisionService] Restoration failed, falling back to original image for OCR.");
        }
        const bufferForOcr = restoredBuffer || originalBuffer;
        const ocrResult = await this.runOcr(bufferForOcr);
        const restoredImageBase64 = restoredBuffer?.toString("base64") || originalBuffer.toString("base64");
        return {
            ...ocrResult,
            restoredImageBase64
        };
    }
    /**
     * End-to-end: restore + OCR from uploaded file buffer.
     */
    async processImageFromBuffer(imageBuffer) {
        if (!imageBuffer || !imageBuffer.length) {
            throw new Error("Image buffer is empty.");
        }
        let restoredBuffer = null;
        try {
            restoredBuffer = await this.restoreImageWithHuggingFace(imageBuffer);
        }
        catch (error) {
            console.warn("[VisionService] Restoration failed, falling back to original image for OCR.");
        }
        const bufferForOcr = restoredBuffer || imageBuffer;
        const ocrResult = await this.runOcr(bufferForOcr);
        const restoredImageBase64 = restoredBuffer?.toString("base64") || imageBuffer.toString("base64");
        return {
            ...ocrResult,
            restoredImageBase64
        };
    }
}
exports.VisionService = VisionService;
