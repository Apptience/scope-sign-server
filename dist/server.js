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
const context_1 = require("./context");
const appRouter_1 = require("./routers/appRouter");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
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
