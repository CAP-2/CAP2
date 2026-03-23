"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChromaService = void 0;
const chromadb_1 = require("chromadb");
const env_1 = require("../../config/env");
const COLLECTION_NAME = "genlink_family";
class ChromaService {
    constructor() {
        this.client = new chromadb_1.ChromaClient({ path: env_1.env.chromaUrl });
        this.collectionPromise = this.initCollection();
    }
    async initCollection() {
        try {
            const collection = await this.client.getOrCreateCollection({
                name: COLLECTION_NAME
            });
            return collection;
        }
        catch (error) {
            console.error("[ChromaService] Failed to init collection", error);
            throw error;
        }
    }
    async getCollection() {
        return this.collectionPromise;
    }
}
exports.ChromaService = ChromaService;
