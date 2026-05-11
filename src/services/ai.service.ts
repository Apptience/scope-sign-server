import { OpenAI } from "openai";
const pdfParse = require("pdf-parse") as any;
import mammoth from "mammoth";
import { randomUUID } from "crypto";
import { db } from "../db";
import { section, scopeCard, activityLog } from "../db/schema";

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const MODEL_ID = "meta-llama/llama-4-scout-17b-16e-instruct";

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return data.text || "";
}

export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value || "";
}

interface ParsedCard {
  title: string;
  description: string;
  icon?: string;
  effort?: string;
  type?: "IN_SCOPE" | "OUT_OF_SCOPE";
  included: string[];
  excluded?: string[];
}

interface ParsedSection {
  title: string;
  cards: ParsedCard[];
}

interface SOWBreakdownResponse {
  sections: ParsedSection[];
}

export async function processSowWithAi(sowText: string, projectId: string): Promise<boolean> {
  if (!sowText || !sowText.trim()) {
    throw new Error("SOW text is empty.");
  }

  const prompt = `
You are an expert project manager and scope-of-work (SOW) architect.
Your task is to analyze the following Scope of Work (SOW) text and break it down into clean, professional modules/sections and modular "scope cards".

Each section represents a phase or high-level category of the project (e.g., "User Authentication & Profiles", "Payment Integration").
Each scope card represents a discrete feature, deliverable, or boundary within that section.

Guidelines for Scope Cards:
- Title: Clear and action-oriented (e.g., "OAuth2 Social Login").
- Description: A highly detailed, professional, and comprehensive paragraph (at least 3-4 sentences long) explaining exactly what this feature comprises, its core business value, and technical execution scope.
- Icon: Pick one corresponding icon name from this pool: ["Feature", "Database", "Shield", "Layout", "Code", "Zap", "Globe", "MessageSquare", "Users", "Settings"].
- Effort: A brief effort estimate if applicable (e.g., "3-5 days", "1 week", or null if not clear).
- Type: Must be "IN_SCOPE" (cards generated should default to IN_SCOPE as they are extracted directly from the SOW).
- Included: A string array detailing precise, clear deliverables or boundaries included under this card.
- Excluded: MUST always be an empty array [] (do not generate or guess any exclusions; the admin user will define them during review).

You MUST reply with a valid JSON object ONLY. Do not include any conversational text, markdown formatting, or prefix/suffix outside of the JSON block.

Expected JSON schema format:
{
  "sections": [
    {
      "title": "User Management",
      "cards": [
        {
          "title": "Secure Sign Up & Profiles",
          "description": "Enables robust and secure user registration with support for password hashing, automatic profile creation, and custom verification flows. This module establishes a foundational security layer for the entire platform, ensuring compliant user credential handling, automated confirmation emails, and interactive user profile dashboards for account management.",
          "icon": "Shield",
          "effort": "4-6 days",
          "type": "IN_SCOPE",
          "included": ["User registration with password hashing", "Email verification flow", "Profile details update (name, avatar)"],
          "excluded": []
        }
      ]
    }
  ]
}

SOW Text:
"""
${sowText}
"""
`;

  console.log("[AI_SERVICE] Sending SOW text to Groq...");
  const response = await openai.chat.completions.create({
    model: MODEL_ID,
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant that only replies with structured JSON. No conversation.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.1,
  });

  const rawContent = response.choices[0]?.message?.content || "";
  console.log("[AI_SERVICE] Received response from Groq. Length:", rawContent.length);

  let cleanContent = rawContent.trim();
  if (cleanContent.startsWith("```json")) {
    cleanContent = cleanContent.substring(7);
  }
  if (cleanContent.endsWith("```")) {
    cleanContent = cleanContent.substring(0, cleanContent.length - 3);
  }
  cleanContent = cleanContent.trim();

  let parsed: SOWBreakdownResponse;
  try {
    parsed = JSON.parse(cleanContent);
  } catch (err) {
    console.error("[AI_SERVICE] Failed to parse JSON response from LLM:", cleanContent);
    throw new Error("The AI model returned an invalid JSON response. Please try again.");
  }

  if (!parsed.sections || !Array.isArray(parsed.sections)) {
    throw new Error("Invalid AI response format: 'sections' array is missing.");
  }

  const now = new Date().toISOString();

  let sectionOrder = 1;

  for (const secData of parsed.sections) {
    const sectionId = randomUUID();
    await db.insert(section).values({
      id: sectionId,
      projectId,
      title: secData.title,
      order: sectionOrder++,
      createdAt: now,
      updatedAt: now,
    });

    let cardOrder = 1;
    if (secData.cards && Array.isArray(secData.cards)) {
      for (const cardData of secData.cards) {
        const cardId = randomUUID();
        await db.insert(scopeCard).values({
          id: cardId,
          projectId,
          sectionId,
          title: cardData.title,
          description: cardData.description,
          icon: cardData.icon || "Feature",
          effort: cardData.effort || null,
          included: JSON.stringify(cardData.included || []),
          excluded: JSON.stringify(cardData.excluded || []),
          type: cardData.type || "IN_SCOPE",
          status: "PENDING",
          order: cardOrder++,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }

  // Add activity log
  await db.insert(activityLog).values({
    id: randomUUID(),
    projectId,
    action: "PROJECT_UPDATED",
    details: JSON.stringify({ note: "SOW parsed and scope cards generated by AI." }),
    createdAt: now,
  });

  return true;
}
