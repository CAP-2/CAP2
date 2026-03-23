import { ChromaClient, Collection } from "chromadb";
import { env } from "../../config/env";

const COLLECTION_NAME = "genlink_family";

export class ChromaService {
  private client: ChromaClient;
  private collectionPromise: Promise<Collection>;

  constructor() {
    this.client = new ChromaClient({ path: env.chromaUrl });
    this.collectionPromise = this.initCollection();
  }

  private async initCollection(): Promise<Collection> {
    try {
      const collection = await this.client.getOrCreateCollection({
        name: COLLECTION_NAME
      });
      console.log("[ChromaService] Collection initialized.");
      return collection;
    } catch (error) {
      console.warn("[ChromaService] Warning: Could not connect to ChromaDB. RAG functionality will fail when used.", error);
      // Return something to avoid crash, but RAG will fail if called
      return null as any; 
    }
  }

  async getCollection(): Promise<Collection> {
    return this.collectionPromise;
  }
}