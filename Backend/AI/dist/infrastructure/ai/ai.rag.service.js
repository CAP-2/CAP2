"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RAGService = void 0;
const google_genai_1 = require("@langchain/google-genai");
const textsplitters_1 = require("@langchain/textsplitters");
const prompts_1 = require("@langchain/core/prompts");
const env_1 = require("../../config/env");
const chroma_client_1 = require("../db/chroma.client");
/**
 * Bản RAG dùng ChromaDB:
 * - Ingest: chunk -> embed -> upsert Chroma.
 * - Chat: embed câu hỏi -> query Chroma -> build context -> gọi Gemini.
 */
class RAGService {
    constructor() {
        if (!env_1.env.geminiApiKey) {
            throw new Error("GEMINI_API_KEY is required for RAGService");
        }
        // Dùng model cũ tương thích API v1beta
        this.embeddings = new google_genai_1.GoogleGenerativeAIEmbeddings({
            apiKey: env_1.env.geminiApiKey,
            model: "embedding-001"
        });
        this.chatModel = new google_genai_1.ChatGoogleGenerativeAI({
            apiKey: env_1.env.geminiApiKey,
            model: "gemini-pro",
            temperature: 0.2
        });
        this.textSplitter = new textsplitters_1.RecursiveCharacterTextSplitter({
            chunkSize: 800,
            chunkOverlap: 200
        });
        this.chroma = new chroma_client_1.ChromaService();
    }
    /**
     * Ingest text gia đình (từ OCR hoặc nhập tay) vào ChromaDB.
     */
    async ingestFamilyText(userId, rawText) {
        if (!userId)
            throw new Error("userId is required.");
        if (!rawText || !rawText.trim())
            throw new Error("rawText is empty.");
        try {
            const docs = await this.textSplitter.createDocuments([rawText], [
                { userId }
            ]);
            const texts = docs.map((d) => d.pageContent);
            if (texts.length === 0) {
                throw new Error("No chunks generated from input text.");
            }
            const metadatas = docs.map((d, idx) => ({
                ...(d.metadata || {}),
                userId,
                chunkIndex: idx
            }));
            const ids = docs.map((_, idx) => `${userId}-${Date.now()}-${idx}-${Math.random()
                .toString(36)
                .slice(2)}`);
            const embeddings = await this.embeddings.embedDocuments(texts);
            const collection = await this.chroma.getCollection();
            await collection.upsert({
                ids,
                documents: texts,
                embeddings,
                metadatas
            });
            return { chunks: texts.length };
        }
        catch (error) {
            console.error("[RAGService-Chroma] Ingest error", error);
            throw new Error("Failed to ingest family text into ChromaDB.");
        }
    }
    /**
     * Chat gia phả với RAG:
     * 1. Embed câu hỏi.
     * 2. Query Chroma theo userId.
     * 3. Build prompt hạn chế hallucination.
     * 4. Gọi Gemini-pro để trả lời.
     */
    async chatAboutHeritage(userId, question) {
        if (!userId)
            throw new Error("userId is required.");
        if (!question || !question.trim())
            throw new Error("question is empty.");
        try {
            const collection = await this.chroma.getCollection();
            const queryEmbedding = await this.embeddings.embedQuery(question);
            const queryResult = await collection.query({
                queryEmbeddings: [queryEmbedding],
                nResults: 6,
                where: { userId }
            });
            const documents = (queryResult.documents?.[0] || []);
            const contextText = documents.length > 0
                ? documents.join("\n\n---\n\n")
                : "No relevant family records found for this user.";
            const prompt = new prompts_1.PromptTemplate({
                template: `
Bạn là trợ lý gia phả GEN-LINK.

Bối cảnh (các trích đoạn từ nhật ký/gia phả, có thể không đầy đủ):
{context}

Câu hỏi của người dùng:
{question}

YÊU CẦU NGHIÊM NGẶT:
- Chỉ sử dụng thông tin có trong bối cảnh ở trên.
- Không được bịa thêm chi tiết không có trong bối cảnh.
- Nếu bối cảnh không đủ để trả lời chính xác, hãy trả lời: "Tôi không đủ thông tin trong hồ sơ gia đình để trả lời chính xác câu hỏi này."
- Trả lời bằng tiếng Việt, mạch lạc, dễ hiểu cho người trong gia đình.

Câu trả lời:`,
                inputVariables: ["context", "question"]
            });
            const finalPrompt = await prompt.format({
                context: contextText,
                question
            });
            const response = await this.chatModel.invoke(finalPrompt);
            let answer;
            if (typeof response.content === "string") {
                answer = response.content;
            }
            else {
                const parts = response.content;
                answer = parts.map((p) => p.text || "").join("");
            }
            return {
                answer: answer.trim(),
                contexts: documents
            };
        }
        catch (error) {
            console.error("[RAGService-Chroma] Chat error", error);
            throw new Error("Failed to answer heritage question via Chroma RAG.");
        }
    }
}
exports.RAGService = RAGService;
