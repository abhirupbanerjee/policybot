import OpenAI from 'openai';
import type { Message } from '@/types';
import { getLLMSettings } from './storage';

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

export async function createEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAI();
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-large';
  const dimensions = parseInt(process.env.EMBEDDING_DIMENSIONS || '3072', 10);

  const response = await openai.embeddings.create({
    model,
    input: text,
    dimensions,
  });
  return response.data[0].embedding;
}

export async function createEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const openai = getOpenAI();
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-large';
  const dimensions = parseInt(process.env.EMBEDDING_DIMENSIONS || '3072', 10);

  const response = await openai.embeddings.create({
    model,
    input: texts,
    dimensions,
  });
  return response.data.map(d => d.embedding);
}

export async function generateResponse(
  systemPrompt: string,
  conversationHistory: Message[],
  context: string,
  userMessage: string
): Promise<string> {
  // Get LLM settings from storage
  const llmSettings = await getLLMSettings();

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
  ];

  // Add conversation history (last 5 messages)
  const recentHistory = conversationHistory.slice(-5);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  // Add context and current question
  messages.push({
    role: 'user',
    content: `Context from policy documents:\n${context}\n\n---\n\nQuestion: ${userMessage}`,
  });

  const openai = getOpenAI();

  // GPT-5 and GPT-5 Mini have different parameter requirements
  const isGPT5Family = llmSettings.model.startsWith('gpt-5');
  const completionParams: any = {
    model: llmSettings.model,
    messages,
  };

  if (isGPT5Family) {
    // GPT-5 family uses max_completion_tokens and only supports temperature=1 (default)
    completionParams.max_completion_tokens = llmSettings.maxTokens;
    // Don't set temperature for GPT-5 (defaults to 1)
  } else {
    // Older models use max_tokens and support custom temperature
    completionParams.max_tokens = llmSettings.maxTokens;
    completionParams.temperature = llmSettings.temperature;
  }

  const response = await openai.chat.completions.create(completionParams);

  return response.choices[0].message.content || '';
}

export async function transcribeAudio(audioBuffer: Buffer, filename: string): Promise<{ text: string; duration: number }> {
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/webm' });
  const file = new File([blob], filename, { type: 'audio/webm' });

  const openai = getOpenAI();
  const response = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file,
    response_format: 'verbose_json',
  });

  return {
    text: response.text,
    duration: response.duration || 0,
  };
}

export default getOpenAI;
