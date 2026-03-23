"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDbConnection = exports.dbPool = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
const env_1 = require("../../config/env");
/**
 * Singleton connection pool to connect to the Docker (Aiven) MySQL DB.
 */
exports.dbPool = promise_1.default.createPool({
    host: env_1.env.dbHost,
    port: env_1.env.dbPort,
    user: env_1.env.dbUser,
    password: env_1.env.dbPassword,
    database: env_1.env.dbName,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});
/**
 * Utility function to test standard connection.
 */
const checkDbConnection = async () => {
    try {
        const connection = await exports.dbPool.getConnection();
        console.log("[MySQL] Successfully connected to the database via AI Service.");
        connection.release();
        return true;
    }
    catch (error) {
        console.error("[MySQL] Failed to connect to database:", error);
        return false;
    }
};
exports.checkDbConnection = checkDbConnection;
