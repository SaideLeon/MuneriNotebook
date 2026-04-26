import { GoogleGenAI } from "@google/genai";

let genAI: GoogleGenAI | null = null;

export const AI_MODEL = "gemini-3-flash-preview";

export function getGeminiClient(): GoogleGenAI {
  if (!genAI) {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}
