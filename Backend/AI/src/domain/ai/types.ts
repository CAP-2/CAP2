export interface VisionOcrResult {
    restoredImageBase64?: string; // base64 of restored image
    text: string;                 // OCR text
    language: string;             // e.g. "vie"
    confidence?: number;          // avg confidence if available
  }
  
  export interface RAGIngestResult {
    chunks: number;
  }
  
  export interface RAGChatResult {
    answer: string;
    contexts: string[];
  }