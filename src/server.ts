import dotenv from "dotenv";
dotenv.config();

import * as trpcExpress from "@trpc/server/adapters/express";
import cors from "cors";
import express from "express";
import multer from "multer";
import { eq } from "drizzle-orm";
import { createContext } from "./context";
import { appRouter } from "./routers/appRouter";
import { db } from "./db";
import { project, section, scopeCard } from "./db/schema";
import { extractTextFromPdf, extractTextFromDocx, processSowWithAi } from "./services/ai.service";

  const app = express();
  const PORT = process.env.PORT || 4000;

  app.use(cors());
  app.use(express.json());

  const upload = multer({ storage: multer.memoryStorage() });

  // SOW PDF/DOCX file upload and AI analysis endpoint
  app.post("/api/projects/:id/upload-sow", upload.single("file"), async (req, res) => {
    const id = req.params.id as string;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No SOW file uploaded." });
    }

    try {
      let sowText = "";
      if (file.mimetype === "application/pdf" || file.originalname.endsWith(".pdf")) {
        sowText = await extractTextFromPdf(file.buffer);
      } else if (
        file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.originalname.endsWith(".docx")
      ) {
        sowText = await extractTextFromDocx(file.buffer);
      } else {
        return res.status(400).json({ error: "Unsupported file type. Please upload a PDF or DOCX file." });
      }

      if (!sowText.trim()) {
        return res.status(400).json({ error: "Could not extract any readable text from the uploaded SOW document." });
      }

      // Save SOW text to the project in DB
      await db.update(project).set({ sowText, updatedAt: new Date().toISOString() }).where(eq(project.id, id));

      // Run AI scope generation
      await processSowWithAi(sowText, id);

      return res.json({ success: true, message: "SOW uploaded and analyzed successfully!" });
    } catch (err: any) {
      console.error("[UPLOAD_SOW_ENDPOINT] Error during SOW processing:", err);
      return res.status(500).json({ error: err.message || "Failed to analyze and generate scope from SOW." });
    }
  });

  // Regenerate SOW scope cards endpoint
  app.post("/api/projects/:id/regenerate-sow", async (req, res) => {
    const id = req.params.id as string;

    try {
      // 1. Fetch project SOW text
      const projects = await db.select().from(project).where(eq(project.id, id));
      const proj = projects[0];

      if (!proj) {
        return res.status(404).json({ error: "Project not found." });
      }

      if (!proj.sowText || !proj.sowText.trim()) {
        return res.status(400).json({ error: "No SOW document has been uploaded for this project yet." });
      }

      // 2. Clear existing cards and sections
      await db.delete(scopeCard).where(eq(scopeCard.projectId, id));
      await db.delete(section).where(eq(section.projectId, id));

      // 3. Re-run AI scope generation
      await processSowWithAi(proj.sowText, id);

      return res.json({ success: true, message: "Scope board regenerated successfully!" });
    } catch (err: any) {
      console.error("[REGENERATE_SOW_ENDPOINT] Error:", err);
      return res.status(500).json({ error: err.message || "Failed to regenerate scope board." });
    }
  });

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({ status: "OK", timestamp: new Date().toISOString() });
  });

  // Mount tRPC API
  app.use(
    "/api/trpc",
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // SSE Notifications Stream for real-time tracking
  const sseClients: express.Response[] = [];

  app.get("/api/notifications/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    sseClients.push(res);

    req.on("close", () => {
      const index = sseClients.indexOf(res);
      if (index !== -1) {
        sseClients.splice(index, 1);
      }
    });
  });

  // Export broadcast helper
  export function broadcastEvent(data: any) {
    sseClients.forEach((client) => {
      client.write(`data: ${JSON.stringify(data)}\n\n`);
    });
  }

  app.listen(PORT, () => {
    console.log(`🚀 ScopeSign Server listening on http://localhost:${PORT}`);
    console.log(`tRPC endpoint active at http://localhost:${PORT}/api/trpc`);
  });
