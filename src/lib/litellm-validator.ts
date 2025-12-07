/**
 * LiteLLM Configuration Validator
 *
 * Validates that models defined in config/defaults.json exist in
 * litellm-proxy/litellm_config.yaml at application startup.
 *
 * Behavior:
 * - FAIL FAST: If default model is missing, exit with detailed error
 * - WARN ONLY: If other preset models are missing, log warning and continue
 */

import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { loadConfig } from './config-loader';

interface ValidationResult {
  valid: boolean;
  defaultModelMissing: boolean;
  missingModels: string[];
  errors: string[];
}

/**
 * Validate LiteLLM configuration against defaults.json
 */
export function validateLiteLLMConfig(): ValidationResult {
  const defaults = loadConfig();
  const yamlPath = path.join(
    process.cwd(),
    'litellm-proxy',
    'litellm_config.yaml'
  );

  const result: ValidationResult = {
    valid: true,
    defaultModelMissing: false,
    missingModels: [],
    errors: [],
  };

  // Check if YAML exists
  if (!fs.existsSync(yamlPath)) {
    result.valid = false;
    result.defaultModelMissing = true;
    result.errors.push(formatError('YAML_NOT_FOUND', yamlPath));
    return result;
  }

  // Parse YAML and get available models
  let litellmConfig: { model_list?: Array<{ model_name: string }> };
  try {
    const yamlContent = fs.readFileSync(yamlPath, 'utf-8');
    litellmConfig = yaml.parse(yamlContent);
  } catch (error) {
    result.valid = false;
    result.defaultModelMissing = true;
    result.errors.push(formatError('YAML_PARSE_ERROR', yamlPath, undefined, error));
    return result;
  }

  const availableModels = new Set(
    litellmConfig.model_list?.map((m) => m.model_name) || []
  );

  // Get default model from LLM settings
  const defaultModel = defaults.llm?.model || defaults.defaultPreset;

  // FAIL FAST: Default model missing
  if (!availableModels.has(defaultModel)) {
    result.valid = false;
    result.defaultModelMissing = true;
    result.missingModels.push(defaultModel);
    result.errors.push(formatError('DEFAULT_MODEL_MISSING', yamlPath, defaultModel));
  }

  // WARN ONLY: Check preset models
  for (const presetKey of Object.keys(defaults.modelPresets || {})) {
    if (!availableModels.has(presetKey) && presetKey !== defaultModel) {
      result.missingModels.push(presetKey);
    }
  }

  // WARN ONLY: Check embedding model
  const embeddingModel = defaults.embedding?.model;
  if (embeddingModel && !availableModels.has(embeddingModel)) {
    result.missingModels.push(embeddingModel);
  }

  // WARN ONLY: Check transcription model
  const transcriptionModel = defaults.models?.transcription;
  if (transcriptionModel && !availableModels.has(transcriptionModel)) {
    result.missingModels.push(transcriptionModel);
  }

  return result;
}

/**
 * Format detailed error messages with guidance
 */
function formatError(
  type: 'YAML_NOT_FOUND' | 'YAML_PARSE_ERROR' | 'DEFAULT_MODEL_MISSING',
  yamlPath: string,
  model?: string,
  parseError?: unknown
): string {
  const divider = '═'.repeat(70);

  if (type === 'YAML_NOT_FOUND') {
    return `
${divider}
❌ FATAL: LiteLLM configuration file not found
${divider}

WHAT'S WRONG:
  The file 'litellm-proxy/litellm_config.yaml' does not exist.

FILE EXPECTED AT:
  ${yamlPath}

HOW TO FIX:
  1. Copy the example config:
     cp litellm-proxy/litellm_config.example.yaml litellm-proxy/litellm_config.yaml

  2. Verify models match those in config/defaults.json

REFERENCE FILES:
  - App defaults: config/defaults.json (modelPresets, llm.model)
  - LiteLLM routing: litellm-proxy/litellm_config.yaml

${divider}
`;
  }

  if (type === 'YAML_PARSE_ERROR') {
    const errorMsg = parseError instanceof Error ? parseError.message : String(parseError);
    return `
${divider}
❌ FATAL: Failed to parse LiteLLM configuration
${divider}

WHAT'S WRONG:
  The file 'litellm-proxy/litellm_config.yaml' contains invalid YAML.

FILE LOCATION:
  ${yamlPath}

PARSE ERROR:
  ${errorMsg}

HOW TO FIX:
  1. Validate YAML syntax:
     npx yaml-lint litellm-proxy/litellm_config.yaml

  2. Or restore from example:
     cp litellm-proxy/litellm_config.example.yaml litellm-proxy/litellm_config.yaml

${divider}
`;
  }

  if (type === 'DEFAULT_MODEL_MISSING') {
    return `
${divider}
❌ FATAL: Default LLM model not found in LiteLLM configuration
${divider}

WHAT'S WRONG:
  The default model '${model}' is configured in defaults.json
  but does NOT exist in litellm_config.yaml.

FILES INVOLVED:
  - Default model defined in: config/defaults.json
    → llm.model: "${model}"
    → OR defaultPreset: "${model}"

  - LiteLLM config at: ${yamlPath}
    → Missing entry for model_name: "${model}"

HOW TO FIX:

  Option 1: Add the model to litellm_config.yaml
  ─────────────────────────────────────────────
  Add an entry to model_list in litellm-proxy/litellm_config.yaml:

  - model_name: ${model}
    litellm_params:
      model: ${model}
      api_key: os.environ/OPENAI_API_KEY

  Option 2: Change the default model in defaults.json
  ─────────────────────────────────────────────────────
  Edit config/defaults.json and change 'llm.model' to a model
  that exists in litellm_config.yaml.

AVAILABLE MODELS IN YAML:
  Run: grep 'model_name:' litellm-proxy/litellm_config.yaml

${divider}
`;
  }

  return '';
}

/**
 * Log warnings for non-critical missing models
 */
export function logMissingModelsWarning(missingModels: string[]): void {
  if (missingModels.length === 0) return;

  console.warn(`
⚠️  WARNING: Some model presets are not configured in LiteLLM
────────────────────────────────────────────────────────────

Missing models: ${missingModels.join(', ')}

These models exist in config/defaults.json but not in litellm_config.yaml.
Users selecting these presets will encounter errors.

To fix: Add missing models to litellm-proxy/litellm_config.yaml

────────────────────────────────────────────────────────────
`);
}

/**
 * Run validation on startup (called from db/index.ts)
 * Exits process if default model is missing
 */
export function validateLiteLLMOnStartup(): void {
  // Skip validation if not using LiteLLM proxy
  const baseUrl = process.env.OPENAI_BASE_URL || '';
  if (!baseUrl.includes('litellm') && !baseUrl.includes(':4000')) {
    return;
  }

  const result = validateLiteLLMConfig();

  // FAIL FAST: Default model missing
  if (result.defaultModelMissing) {
    console.error(result.errors[0]);
    process.exit(1);
  }

  // WARN ONLY: Other models missing (exclude default which was already checked)
  const nonDefaultMissing = result.missingModels.filter(
    (m) => !result.errors.some((e) => e.includes(`'${m}'`))
  );
  logMissingModelsWarning(nonDefaultMissing);
}
