import { getGeminiClient, AI_MODEL } from "./gemini.client";

export const AIService = {
  async generateContent(parts: any[]) {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: AI_MODEL,
      contents: { parts }
    });
    return response.text || '';
  }
};
