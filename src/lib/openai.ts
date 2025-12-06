import OpenAI from 'openai';
import type { Message, ToolCall } from '@/types';
import { getLLMSettings } from './storage';
import { getToolDefinitions, executeTool } from './tools';

let openaiClient: OpenAI | null = null;

// Models with reliable function/tool calling support
const TOOL_CAPABLE_MODELS = new Set([
  // OpenAI - GPT-4.1 Family
  'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-3.5-turbo',
  // Mistral - Mistral 3 Family
  'mistral-large-3', 'mistral-medium-3.1', 'mistral-small-3.2', 'ministral-8b', 'ministral-3b',
  // Ollama (with native tool support)
  'ollama-llama3.2', 'ollama-llama3.1', 'ollama-mistral', 'ollama-qwen2.5',
]);

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    // When using LiteLLM proxy, use LITELLM_MASTER_KEY for authentication
    // Otherwise fall back to OPENAI_API_KEY for direct OpenAI access
    const apiKey = process.env.OPENAI_BASE_URL
      ? (process.env.LITELLM_MASTER_KEY || process.env.OPENAI_API_KEY)
      : process.env.OPENAI_API_KEY;

    openaiClient = new OpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    });
  }
  return openaiClient;
}

export async function createEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAI();
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-large';

  const response = await openai.embeddings.create({
    model,
    input: text,
  });
  return response.data[0].embedding;
}

export async function createEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const openai = getOpenAI();
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-large';

  const response = await openai.embeddings.create({
    model,
    input: texts,
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
    // Skip tool messages in non-tool-calling flow
    if (msg.role === 'tool') continue;

    messages.push({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    });
  }

  // Add context and current question
  messages.push({
    role: 'user',
    content: `Organizational Knowledge Base:\n${context}\n\n---\n\nQuestion: ${userMessage}`,
  });

  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
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

  // Check if model supports tools, disable gracefully if not
  const modelSupportsTools = TOOL_CAPABLE_MODELS.has(llmSettings.model);
  const effectiveEnableTools = enableTools && modelSupportsTools;

  if (enableTools && !modelSupportsTools) {
    console.warn(`Model ${llmSettings.model} does not support tools, disabling`);
  }

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
    content: `Organizational Knowledge Base:\n${context}\n\n---\n\nQuestion: ${userMessage}`,
  });

  // Prepare completion params
  const tools = effectiveEnableTools ? getToolDefinitions() : undefined;
  const completionParams = {
    model: llmSettings.model,
    messages,
    tools,
    max_tokens: llmSettings.maxTokens,
    temperature: llmSettings.temperature,
  };

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
    response = await openai.chat.completions.create({
      ...completionParams,
      messages,
    });
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
