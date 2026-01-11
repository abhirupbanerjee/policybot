/**
 * Agent Model Configuration Database Operations
 *
 * Manages storage and retrieval of LLM model configurations for autonomous mode agents
 */

import { getSetting, setSetting } from './config';

export interface AgentModelConfig {
  provider: 'openai' | 'gemini' | 'mistral';
  model: string;
  temperature: number;
  max_tokens?: number;
}

export interface StoredAgentModelConfigs {
  planner: AgentModelConfig;
  executor: AgentModelConfig;
  checker: AgentModelConfig;
  summarizer: AgentModelConfig;
}

// Default configurations (used when no custom config exists)
const DEFAULT_CONFIGS: StoredAgentModelConfigs = {
  planner: {
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    temperature: 0.3,
    max_tokens: 8192, // Planner needs large output for per-item task lists
  },
  executor: {
    provider: 'openai',
    model: 'gpt-4.1-mini',
    temperature: 0.4,
    max_tokens: 4096,
  },
  checker: {
    provider: 'openai',
    model: 'gpt-4.1-mini',
    temperature: 0.2,
    max_tokens: 2048, // Checker outputs are small
  },
  summarizer: {
    provider: 'openai',
    model: 'gpt-4.1-mini',
    temperature: 0.5,
    max_tokens: 4096,
  },
};

/**
 * Get agent model configurations from database
 */
export function getAgentModelConfigs(): StoredAgentModelConfigs {
  try {
    const plannerJson = getSetting('agent_model_planner', '');
    const executorJson = getSetting('agent_model_executor', '');
    const checkerJson = getSetting('agent_model_checker', '');
    const summarizerJson = getSetting('agent_model_summarizer', '');

    return {
      planner: plannerJson ? JSON.parse(plannerJson) : DEFAULT_CONFIGS.planner,
      executor: executorJson ? JSON.parse(executorJson) : DEFAULT_CONFIGS.executor,
      checker: checkerJson ? JSON.parse(checkerJson) : DEFAULT_CONFIGS.checker,
      summarizer: summarizerJson ? JSON.parse(summarizerJson) : DEFAULT_CONFIGS.summarizer,
    };
  } catch (error) {
    console.error('[Agent Config] Error loading model configs:', error);
    return DEFAULT_CONFIGS;
  }
}

/**
 * Save agent model configurations to database
 */
export function setAgentModelConfigs(
  configs: StoredAgentModelConfigs,
  updatedBy: string
): void {
  setSetting('agent_model_planner', JSON.stringify(configs.planner), updatedBy);
  setSetting('agent_model_executor', JSON.stringify(configs.executor), updatedBy);
  setSetting('agent_model_checker', JSON.stringify(configs.checker), updatedBy);
  setSetting('agent_model_summarizer', JSON.stringify(configs.summarizer), updatedBy);
}

/**
 * Validate agent model configuration
 */
export function validateAgentModelConfig(config: AgentModelConfig): boolean {
  if (!config.provider || !['openai', 'gemini', 'mistral'].includes(config.provider)) {
    return false;
  }
  if (!config.model || config.model.trim() === '') {
    return false;
  }
  if (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 2) {
    return false;
  }
  return true;
}
