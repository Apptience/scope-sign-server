"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.broadcastEvent = broadcastEvent;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const trpcExpress = __importStar(require("@trpc/server/adapters/express"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const drizzle_orm_1 = require("drizzle-orm");
const context_1 = require("./context");
const appRouter_1 = require("./routers/appRouter");
const db_1 = require("./db");
const schema_1 = require("./db/schema");
const ai_service_1 = require("./services/ai.service");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
// SOW PDF/DOCX file upload and AI analysis endpoint
app.post("/api/projects/:id/upload-sow", upload.single("file"), async (req, res) => {
    const id = req.params.id;
    const file = req.file;
    if (!file) {
        return res.status(400).json({ error: "No SOW file uploaded." });
    }
    try {
        let sowText = "";
        if (file.mimetype === "application/pdf" || file.originalname.endsWith(".pdf")) {
            sowText = await (0, ai_service_1.extractTextFromPdf)(file.buffer);
        }
        else if (file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
            file.originalname.endsWith(".docx")) {
            sowText = await (0, ai_service_1.extractTextFromDocx)(file.buffer);
        }
        else {
            return res.status(400).json({ error: "Unsupported file type. Please upload a PDF or DOCX file." });
        }
        if (!sowText.trim()) {
            return res.status(400).json({ error: "Could not extract any readable text from the uploaded SOW document." });
        }
        // Save SOW text to the project in DB
        await db_1.db.update(schema_1.project).set({ sowText, updatedAt: new Date().toISOString() }).where((0, drizzle_orm_1.eq)(schema_1.project.id, id));
        // Run AI scope generation
        await (0, ai_service_1.processSowWithAi)(sowText, id);
        return res.json({ success: true, message: "SOW uploaded and analyzed successfully!" });
    }
    catch (err) {
        console.error("[UPLOAD_SOW_ENDPOINT] Error during SOW processing:", err);
        return res.status(500).json({ error: err.message || "Failed to analyze and generate scope from SOW." });
    }
});
// Regenerate SOW scope cards endpoint
app.post("/api/projects/:id/regenerate-sow", async (req, res) => {
    const id = req.params.id;
    try {
        // 1. Fetch project SOW text
        const projects = await db_1.db.select().from(schema_1.project).where((0, drizzle_orm_1.eq)(schema_1.project.id, id));
        const proj = projects[0];
        if (!proj) {
            return res.status(404).json({ error: "Project not found." });
        }
        if (!proj.sowText || !proj.sowText.trim()) {
            return res.status(400).json({ error: "No SOW document has been uploaded for this project yet." });
        }
        // 2. Clear existing cards and sections
        await db_1.db.delete(schema_1.scopeCard).where((0, drizzle_orm_1.eq)(schema_1.scopeCard.projectId, id));
        await db_1.db.delete(schema_1.section).where((0, drizzle_orm_1.eq)(schema_1.section.projectId, id));
        // 3. Re-run AI scope generation
        await (0, ai_service_1.processSowWithAi)(proj.sowText, id);
        return res.json({ success: true, message: "Scope board regenerated successfully!" });
    }
    catch (err) {
        console.error("[REGENERATE_SOW_ENDPOINT] Error:", err);
        return res.status(500).json({ error: err.message || "Failed to regenerate scope board." });
    }
});
// Health check endpoint
app.get("/health", (_req, res) => {
    res.json({ status: "OK", timestamp: new Date().toISOString() });
});
// Mount tRPC API
app.use("/api/trpc", trpcExpress.createExpressMiddleware({
    router: appRouter_1.appRouter,
    createContext: context_1.createContext,
}));
// SSE Notifications Stream for real-time tracking
const sseClients = [];
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
function broadcastEvent(data) {
    sseClients.forEach((client) => {
        client.write(`data: ${JSON.stringify(data)}\n\n`);
    });
}
app.listen(PORT, () => {
    console.log(`🚀 ScopeSign Server listening on http://localhost:${PORT}`);
    console.log(`tRPC endpoint active at http://localhost:${PORT}/api/trpc`);
});
