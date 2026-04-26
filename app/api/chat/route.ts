import { NextRequest, NextResponse } from 'next/server';
import { AIService } from '@/services/ai/ai-service';

export async function POST(req: NextRequest) {
  try {
    const { parts } = await req.json();
    const responseText = await AIService.generateContent(parts);
    return new NextResponse(responseText);
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return new NextResponse(error.message || 'Internal Server Error', { status: 500 });
  }
}
