import mysql from "mysql2/promise";
import { env } from "../../config/env";

/**
 * Singleton connection pool to connect to the Docker (Aiven) MySQL DB.
 */
export const dbPool = mysql.createPool({
  host: env.dbHost,
  port: env.dbPort,
  user: env.dbUser,
  password: env.dbPassword,
  database: env.dbName,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

/**
 * Utility function to test standard connection.
 */
export const checkDbConnection = async () => {
  try {
    const connection = await dbPool.getConnection();
    console.log("[MySQL] Successfully connected to the database via AI Service.");
    connection.release();
    return true;
  } catch (error) {
    console.error("[MySQL] Failed to connect to database:", error);
    return false;
  }
};
