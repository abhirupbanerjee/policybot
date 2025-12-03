import OpenAI from 'openai';
import type { Message, ToolCall } from '@/types';
import { getLLMSettings } from './storage';
import { getToolDefinitions, executeTool } from './tools';

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

  const response = isGPT5Family
    ? await openai.chat.completions.create({
        model: llmSettings.model,
        messages,
        max_completion_tokens: llmSettings.maxTokens,
        // GPT-5 family only supports temperature=1 (default)
      })
    : await openai.chat.completions.create({
        model: llmSettings.model,
        messages,
        max_tokens: llmSettings.maxTokens,
        temperature: llmSettings.temperature,
      });

  return response.choices[0].message.content || '';
}

export async function generateResponseWithTools(
  systemPrompt: string,
  conversationHistory: Message[],
  context: string,
  userMessage: string,
  enableTools: boolean = true
): Promise<{
  content: string;
  toolCalls?: ToolCall[];
  fullHistory: OpenAI.Chat.ChatCompletionMessageParam[];
}> {
  const llmSettings = await getLLMSettings();
  const openai = getOpenAI();

  // GPT-5, GPT-5-mini, and GPT-4o-mini all support function calling
  const isGPT5Family = llmSettings.model.startsWith('gpt-5');

  // Build messages array
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
  ];

  // Add conversation history (last 5 messages, including tool calls)
  for (const msg of conversationHistory.slice(-5)) {
    if (msg.role === 'tool') {
      messages.push({
        role: 'tool',
        tool_call_id: msg.tool_call_id!,
        content: msg.content,
      });
    } else if (msg.role === 'assistant' && msg.tool_calls) {
      messages.push({
        role: 'assistant',
        content: msg.content || null,
        tool_calls: msg.tool_calls,
      });
    } else {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }
  }

  // Add context + user question
  messages.push({
    role: 'user',
    content: `Policy Documents Context:\n${context}\n\n---\n\nQuestion: ${userMessage}`,
  });

  // Prepare completion params
  const tools = enableTools ? getToolDefinitions() : undefined;
  const baseParams = {
    model: llmSettings.model,
    messages,
    tools,
  };

  // Handle GPT-5 vs other models (GPT-4o-mini uses standard params)
  const completionParams = isGPT5Family
    ? { ...baseParams, max_completion_tokens: llmSettings.maxTokens }
    : { ...baseParams, max_tokens: llmSettings.maxTokens, temperature: llmSettings.temperature };

  // First API call
  let response = await openai.chat.completions.create(completionParams);
  let responseMessage = response.choices[0].message;

  // Tool call loop (max 3 iterations to prevent runaway)
  let iterations = 0;
  const MAX_ITERATIONS = 3;

  while (responseMessage.tool_calls && iterations < MAX_ITERATIONS) {
    iterations++;
    console.log(`Tool call iteration ${iterations}/${MAX_ITERATIONS}`);

    // Add assistant's tool call message
    messages.push({
      role: 'assistant',
      content: responseMessage.content,
      tool_calls: responseMessage.tool_calls,
    });

    // Execute each tool call
    for (const toolCall of responseMessage.tool_calls) {
      console.log(`Executing tool: ${toolCall.function.name}`);

      const result = await executeTool(
        toolCall.function.name,
        toolCall.function.arguments
      );

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: result,
      });
    }

    // Get next response with tool results
    const nextParams = isGPT5Family
      ? { ...baseParams, messages, max_completion_tokens: llmSettings.maxTokens }
      : { ...baseParams, messages, max_tokens: llmSettings.maxTokens, temperature: llmSettings.temperature };

    response = await openai.chat.completions.create(nextParams);
    responseMessage = response.choices[0].message;
  }

  if (iterations >= MAX_ITERATIONS && responseMessage.tool_calls) {
    console.warn('Max tool call iterations reached');
  }

  return {
    content: responseMessage.content || '',
    toolCalls: responseMessage.tool_calls as ToolCall[] | undefined,
    fullHistory: messages,
  };
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
