"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createContext = createContext;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("./db");
async function createContext({ req, res }) {
    let user = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        try {
            const secret = process.env.JWT_SECRET || "super-secret-jwt-key-change-in-production";
            const decoded = jsonwebtoken_1.default.verify(token, secret);
            user = decoded;
        }
        catch (err) {
            // Allow context to be created even if JWT is invalid
        }
    }
    const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
    return {
        req,
        res,
        db: db_1.db,
        user,
        clientIp,
    };
}
