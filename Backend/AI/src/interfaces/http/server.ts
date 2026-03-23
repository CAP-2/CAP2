import express from "express";
import cors from "cors";
import aiRoutes from "./routes/ai.routes";
import { env } from "../../config/env";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api/ai", aiRoutes);

// Simple health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "gen-link-backend" });
});

app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("[GlobalError]", err);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
      details: err instanceof Error ? err.message : "Unknown error"
    });
  }
);

app.listen(env.port, () => {
  console.log(`GEN-LINK backend listening on port ${env.port}`);
});