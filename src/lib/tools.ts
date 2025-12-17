import type { OpenAI } from 'openai';
import { tavilyWebSearch } from './tools/tavily';
import { documentGenerationTool } from './tools/docgen';
import { dataSourceTool } from './tools/data-source';
import { isToolEnabled as isToolEnabledDb, migrateTavilySettingsIfNeeded, ensureToolConfigsExist } from './db/tool-config';

// ============ Types ============

/**
 * Tool category determines how the tool is invoked
 * - autonomous: LLM-triggered via OpenAI function calling (e.g., web_search)
 * - processor: Post-response output processor (e.g., data_viz, doc_gen)
 */
export type ToolCategory = 'autonomous' | 'processor';

/**
 * Validation result for tool configuration
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Extended tool interface for the unified Tools system
 * Each tool has a definition, execution logic, validation, and configuration
 */
export interface ToolDefinition {
  /** Unique tool identifier (e.g., 'web_search') */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** Description of what the tool does */
  description: string;
  /** Tool category - how it's invoked */
  category: ToolCategory;
  /** OpenAI function definition (only for autonomous tools) */
  definition?: OpenAI.Chat.ChatCompletionTool;
  /** Execute the tool with arguments */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (args: any) => Promise<string>;
  /** Validate tool configuration */
  validateConfig: (config: Record<string, unknown>) => ValidationResult;
  /** Default configuration values */
  defaultConfig: Record<string, unknown>;
  /** JSON Schema for configuration (for admin UI generation) */
  configSchema: Record<string, unknown>;
}

/**
 * Legacy tool interface for backward compatibility
 * @deprecated Use ToolDefinition instead
 */
export interface LegacyToolDefinition {
  definition: OpenAI.Chat.ChatCompletionTool;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (args: any) => Promise<string>;
}

// ============ Tool Registry ============

/**
 * Tool registry - maps tool names to their definitions
 * Import tool implementations from separate files for modularity
 */
export const AVAILABLE_TOOLS: Record<string, ToolDefinition> = {
  web_search: tavilyWebSearch,
  doc_gen: documentGenerationTool,
  data_source: dataSourceTool,
};

// ============ Initialization ============

let toolsInitialized = false;

/**
 * Initialize the tools system
 * - Migrates legacy Tavily settings to tool_configs table
 * - Ensures all registered tools have configurations
 */
export function initializeTools(): void {
  if (toolsInitialized) return;

  try {
    // Migrate existing Tavily settings if needed
    migrateTavilySettingsIfNeeded();

    // Ensure all registered tools have configs
    ensureToolConfigsExist();

    toolsInitialized = true;
    console.log('[Tools] Tools system initialized');
  } catch (error) {
    console.error('[Tools] Failed to initialize tools system:', error);
  }
}

// ============ Tool Access ============

/**
 * Check if a tool is enabled
 * Uses database configuration
 */
export function isToolEnabled(name: string): boolean {
  initializeTools();
  return isToolEnabledDb(name);
}

/**
 * Get all tool definitions for OpenAI API
 * Only returns definitions for enabled autonomous tools
 */
export function getToolDefinitions(): OpenAI.Chat.ChatCompletionTool[] {
  initializeTools();
  return Object.values(AVAILABLE_TOOLS)
    .filter(tool => tool.category === 'autonomous' && tool.definition && isToolEnabled(tool.name))
    .map(tool => tool.definition!);
}

/**
 * Get all enabled autonomous tool definitions (alias for getToolDefinitions)
 */
export function getEnabledAutonomousTools(): OpenAI.Chat.ChatCompletionTool[] {
  return getToolDefinitions();
}

/**
 * Get all processor tools (for post-response processing)
 */
export function getProcessorTools(): ToolDefinition[] {
  initializeTools();
  return Object.values(AVAILABLE_TOOLS)
    .filter(tool => tool.category === 'processor' && isToolEnabled(tool.name));
}

/**
 * Get a tool by name
 */
export function getTool(name: string): ToolDefinition | undefined {
  return AVAILABLE_TOOLS[name];
}

/**
 * Get all registered tools (for admin panel)
 */
export function getAllTools(): ToolDefinition[] {
  return Object.values(AVAILABLE_TOOLS);
}

// ============ Tool Execution ============

/**
 * Execute a tool by name with arguments
 * @param name - Tool name (e.g., 'web_search')
 * @param args - JSON string of tool arguments
 * @returns JSON string result
 */
export async function executeTool(name: string, args: string): Promise<string> {
  initializeTools();

  const tool = AVAILABLE_TOOLS[name];
  if (!tool) {
    return JSON.stringify({
      error: `Unknown tool: ${name}`,
      errorCode: 'UNKNOWN_TOOL',
    });
  }

  // Check if tool is enabled
  if (!isToolEnabled(name)) {
    return JSON.stringify({
      error: `Tool '${name}' is currently disabled`,
      errorCode: 'TOOL_DISABLED',
    });
  }

  try {
    const parsedArgs = JSON.parse(args);
    return await tool.execute(parsedArgs);
  } catch (error) {
    console.error(`Tool execution error [${name}]:`, error);
    return JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      errorCode: 'EXECUTION_ERROR',
    });
  }
}

// ============ Utility Functions ============

/**
 * Get tool metadata for display
 */
export function getToolMetadata(name: string): {
  name: string;
  displayName: string;
  description: string;
  category: ToolCategory;
  enabled: boolean;
} | undefined {
  const tool = AVAILABLE_TOOLS[name];
  if (!tool) return undefined;

  return {
    name: tool.name,
    displayName: tool.displayName,
    description: tool.description,
    category: tool.category,
    enabled: isToolEnabled(name),
  };
}

/**
 * Validate a tool's configuration
 */
export function validateToolConfig(
  name: string,
  config: Record<string, unknown>
): ValidationResult {
  const tool = AVAILABLE_TOOLS[name];
  if (!tool) {
    return { valid: false, errors: [`Unknown tool: ${name}`] };
  }
  return tool.validateConfig(config);
}
