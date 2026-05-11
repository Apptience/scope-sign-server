import { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import jwt from "jsonwebtoken";
import { db } from "./db";

export interface UserPayload {
  userId: string;
  email: string;
  agencyId: string;
  role: string;
}

export async function createContext({ req, res }: CreateExpressContextOptions) {
  let user: UserPayload | null = null;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    try {
      const secret = process.env.JWT_SECRET || "super-secret-jwt-key-change-in-production";
      const decoded = jwt.verify(token, secret) as UserPayload;
      user = decoded;
    } catch (err) {
      // Allow context to be created even if JWT is invalid
    }
  }

  const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";

  return {
    req,
    res,
    db,
    user,
    clientIp,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
