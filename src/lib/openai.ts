import OpenAI from 'openai';
import type { Message, ToolCall, StreamingCallbacks, MessageVisualization, GeneratedDocumentInfo, GeneratedImageInfo } from '@/types';
import { getLlmSettings, getEmbeddingSettings, getLimitsSettings, getEffectiveMaxTokens } from './db/config';
import { getToolDisplayName } from './streaming/utils';
import { getToolDefinitions, executeTool } from './tools';
import { resolveToolRouting } from './tool-routing';
import { toolsLogger as logger } from './logger';
import {
  TOOL_CAPABLE_MODELS,
  MAX_TOOL_CALL_ITERATIONS,
  DEFAULT_CONVERSATION_HISTORY_LIMIT,
} from './constants';

let openaiClient: OpenAI | null = null;

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
  const embeddingSettings = getEmbeddingSettings();
  // Use database config, fall back to env var for backward compatibility
  const model = embeddingSettings.model || process.env.EMBEDDING_MODEL || 'text-embedding-3-large';

  const response = await openai.embeddings.create({
    model,
    input: text,
  });
  return response.data[0].embedding;
}

export async function createEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const openai = getOpenAI();
  const embeddingSettings = getEmbeddingSettings();
  // Use database config, fall back to env var for backward compatibility
  const model = embeddingSettings.model || process.env.EMBEDDING_MODEL || 'text-embedding-3-large';

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
  // Get LLM settings from database config
  const llmSettings = getLlmSettings();

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
  ];

  // Add conversation history (last N messages)
  const recentHistory = conversationHistory.slice(-DEFAULT_CONVERSATION_HISTORY_LIMIT);
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

  // Get effective max tokens (uses per-model override if configured, otherwise preset default)
  const effectiveMaxTokens = getEffectiveMaxTokens(llmSettings.model);

  const response = await openai.chat.completions.create({
    model: llmSettings.model,
    messages,
    max_tokens: effectiveMaxTokens,
    temperature: llmSettings.temperature,
  });

  return response.choices[0].message.content || '';
}

export async function generateResponseWithTools(
  systemPrompt: string,
  conversationHistory: Message[],
  context: string,
  userMessage: string,
  enableTools: boolean = true,
  categoryIds?: number[],
  callbacks?: StreamingCallbacks
): Promise<{
  content: string;
  toolCalls?: ToolCall[];
  fullHistory: OpenAI.Chat.ChatCompletionMessageParam[];
}> {
  const llmSettings = getLlmSettings();
  const openai = getOpenAI();

  // Check if model supports tools, disable gracefully if not
  const modelSupportsTools = TOOL_CAPABLE_MODELS.has(llmSettings.model);
  const effectiveEnableTools = enableTools && modelSupportsTools;

  if (enableTools && !modelSupportsTools) {
    logger.warn(`Model ${llmSettings.model} does not support tools, disabling`);
  }

  // Build messages array
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
  ];

  // Add conversation history (configurable limit, including tool calls)
  const limitsSettings = getLimitsSettings();
  const historyLimit = limitsSettings.conversationHistoryMessages;
  for (const msg of conversationHistory.slice(-historyLimit)) {
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

  // Prepare completion params - pass categoryIds for dynamic Function API tools
  const tools = effectiveEnableTools ? getToolDefinitions(categoryIds) : undefined;

  // Apply tool routing to determine tool_choice
  let toolChoice: 'auto' | 'required' | { type: 'function'; function: { name: string } } | undefined;

  if (effectiveEnableTools && tools && tools.length > 0) {
    const routing = resolveToolRouting(userMessage, categoryIds || []);

    if (routing.matches.length > 0) {
      toolChoice = routing.toolChoice;
      logger.info('Tool routing applied', {
        matches: routing.matches.map((m) => `${m.toolName}:${m.matchedPattern}`),
        toolChoice:
          typeof toolChoice === 'object' ? toolChoice.function.name : toolChoice,
      });
    }
  }

  // Get effective max tokens (uses per-model override if configured, otherwise preset default)
  const effectiveMaxTokens = getEffectiveMaxTokens(llmSettings.model);

  const completionParams: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
    model: llmSettings.model,
    messages,
    tools,
    tool_choice: tools?.length ? toolChoice : undefined,
    max_tokens: effectiveMaxTokens,
    temperature: llmSettings.temperature,
  };

  // First API call
  let response = await openai.chat.completions.create(completionParams);
  let responseMessage = response.choices[0].message;

  // Tool call loop (max iterations to prevent runaway)
  let iterations = 0;

  while (responseMessage.tool_calls && iterations < MAX_TOOL_CALL_ITERATIONS) {
    iterations++;
    logger.debug(`Tool call iteration ${iterations}/${MAX_TOOL_CALL_ITERATIONS}`);

    // Add assistant's tool call message
    messages.push({
      role: 'assistant',
      content: responseMessage.content,
      tool_calls: responseMessage.tool_calls,
    });

    // Execute each tool call
    for (const toolCall of responseMessage.tool_calls) {
      const toolName = toolCall.function.name;
      const displayName = getToolDisplayName(toolName);
      const startTime = Date.now();

      logger.debug(`Executing tool: ${toolName}`);

      // Notify streaming callback that tool is starting
      callbacks?.onToolStart?.(toolName, displayName);

      let result: string;
      let success = true;
      let errorMsg: string | undefined;

      try {
        result = await executeTool(toolName, toolCall.function.arguments);

        // Check if result indicates an error
        try {
          const parsed = JSON.parse(result);
          if (parsed.error || parsed.errorCode) {
            success = false;
            errorMsg = parsed.error || 'Tool execution failed';
          } else {
            // Extract artifacts for streaming callbacks
            if (callbacks?.onArtifact) {
              // Check for visualization
              if (parsed.success && parsed.data && parsed.visualizationHint) {
                const viz: MessageVisualization = {
                  chartType: parsed.visualizationHint.chartType,
                  data: parsed.data,
                  xField: parsed.visualizationHint.xField,
                  yField: parsed.visualizationHint.yField,
                  yFields: parsed.visualizationHint.yFields,
                  groupBy: parsed.visualizationHint.groupBy,
                  title: parsed.chartTitle,
                  notes: parsed.notes,
                  seriesMode: parsed.seriesMode,
                };
                callbacks.onArtifact('visualization', viz);
              }

              // Check for generated document
              if (parsed.success && parsed.document) {
                const doc: GeneratedDocumentInfo = {
                  id: parsed.document.id,
                  filename: parsed.document.filename,
                  fileType: parsed.document.fileType,
                  fileSize: parsed.document.fileSize || 0,
                  fileSizeFormatted: parsed.document.fileSizeFormatted || '',
                  downloadUrl: parsed.document.downloadUrl,
                  expiresAt: parsed.document.expiresAt || null,
                };
                callbacks.onArtifact('document', doc);
              }

              // Check for generated image
              if (parsed.success && parsed.imageHint) {
                const img: GeneratedImageInfo = {
                  id: parsed.imageHint.id,
                  url: parsed.imageHint.url,
                  thumbnailUrl: parsed.imageHint.thumbnailUrl,
                  width: parsed.imageHint.width,
                  height: parsed.imageHint.height,
                  alt: parsed.imageHint.alt || 'Generated image',
                  provider: parsed.metadata?.provider,
                  model: parsed.metadata?.model,
                };
                callbacks.onArtifact('image', img);
              }
            }
          }
        } catch {
          // Result is not JSON, treat as success
        }
      } catch (error) {
        success = false;
        errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result = JSON.stringify({ error: errorMsg, errorCode: 'EXECUTION_ERROR' });
      }

      const duration = Date.now() - startTime;

      // Notify streaming callback that tool completed
      callbacks?.onToolEnd?.(toolName, success, duration, errorMsg);

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

  if (iterations >= MAX_TOOL_CALL_ITERATIONS && responseMessage.tool_calls) {
    logger.warn('Max tool call iterations reached');
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
