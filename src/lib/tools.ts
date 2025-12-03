import type { OpenAI } from 'openai';
import { tavilyWebSearch } from './tools/tavily';

/**
 * Generic tool interface for OpenAI function calling
 * Each tool has a definition (for OpenAI API) and an execute function
 */
export interface ToolDefinition {
  definition: OpenAI.Chat.ChatCompletionTool;
  execute: (args: any) => Promise<string>;
}

/**
 * Tool registry - easily add new tools here
 * Import tool implementations from separate files for modularity
 */
export const AVAILABLE_TOOLS: Record<string, ToolDefinition> = {
  web_search: tavilyWebSearch,
  // Future tools can be added here:
  // calculator: calculatorTool,
  // image_search: imageSearchTool,
};

/**
 * Get all tool definitions for OpenAI API
 */
export function getToolDefinitions(): OpenAI.Chat.ChatCompletionTool[] {
  return Object.values(AVAILABLE_TOOLS).map(t => t.definition);
}

/**
 * Execute a tool by name with arguments
 * @param name - Tool name (e.g., 'web_search')
 * @param args - JSON string of tool arguments
 * @returns JSON string result
 */
export async function executeTool(name: string, args: string): Promise<string> {
  const tool = AVAILABLE_TOOLS[name];
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }

  try {
    const parsedArgs = JSON.parse(args);
    return await tool.execute(parsedArgs);
  } catch (error) {
    console.error(`Tool execution error [${name}]:`, error);
    return JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
