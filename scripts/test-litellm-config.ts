/**
 * LiteLLM Configuration Validator
 *
 * Tests that all models in litellm_config.yaml are properly configured.
 * Run: npx tsx scripts/test-litellm-config.ts
 */

import yaml from 'yaml';
import fs from 'fs';
import path from 'path';

interface LiteLLMModel {
  model_name: string;
  litellm_params: {
    model: string;
    api_key?: string;
    api_base?: string;
  };
  model_info?: {
    supports_function_calling?: boolean;
    supports_vision?: boolean;
    max_input_tokens?: number;
  };
}

interface LiteLLMConfig {
  model_list: LiteLLMModel[];
  litellm_settings?: Record<string, unknown>;
  general_settings?: {
    master_key?: string;
    [key: string]: unknown;
  };
}

function validateConfig(): void {
  const yamlPath = path.join(process.cwd(), 'litellm-proxy', 'litellm_config.yaml');

  if (!fs.existsSync(yamlPath)) {
    console.error('❌ YAML file not found:', yamlPath);
    process.exit(1);
  }

  const yamlContent = fs.readFileSync(yamlPath, 'utf-8');
  const config = yaml.parse(yamlContent) as LiteLLMConfig;

  console.log('='.repeat(70));
  console.log('LITELLM CONFIGURATION VALIDATION');
  console.log('='.repeat(70));
  console.log();

  const errors: string[] = [];
  const warnings: string[] = [];

  // Check model_list exists
  if (!config.model_list || !Array.isArray(config.model_list)) {
    errors.push('model_list is missing or not an array');
  } else {
    console.log(`Total models: ${config.model_list.length}`);
    console.log();

    // Group models by category
    const chatModels: LiteLLMModel[] = [];
    const embeddingModels: LiteLLMModel[] = [];
    const transcriptionModels: LiteLLMModel[] = [];

    config.model_list.forEach((model) => {
      const litellmModel = model.litellm_params?.model || '';
      if (litellmModel.includes('embed')) {
        embeddingModels.push(model);
      } else if (litellmModel.includes('whisper') || litellmModel.includes('voxtral')) {
        transcriptionModels.push(model);
      } else {
        chatModels.push(model);
      }
    });

    // Validate each model
    config.model_list.forEach((model, idx) => {
      const name = model.model_name || `[unnamed model #${idx}]`;

      // Required fields
      if (!model.model_name) {
        errors.push(`Model #${idx}: missing model_name`);
      }
      if (!model.litellm_params) {
        errors.push(`${name}: missing litellm_params`);
      } else {
        if (!model.litellm_params.model) {
          errors.push(`${name}: missing litellm_params.model`);
        }

        // Check auth - needs either api_key or api_base
        const hasApiKey = model.litellm_params.api_key;
        const hasApiBase = model.litellm_params.api_base;

        if (!hasApiKey && !hasApiBase) {
          errors.push(`${name}: missing both api_key and api_base`);
        }

        // Validate env var format
        if (hasApiKey && !hasApiKey.startsWith('os.environ/')) {
          warnings.push(`${name}: api_key should use os.environ/ format`);
        }
        if (hasApiBase && !hasApiBase.startsWith('os.environ/')) {
          warnings.push(`${name}: api_base should use os.environ/ format`);
        }
      }
    });

    // Print model summary by category
    const printModelTable = (title: string, models: LiteLLMModel[]) => {
      if (models.length === 0) return;

      console.log(title);
      console.log('-'.repeat(70));
      console.log(
        'Model Name'.padEnd(22) +
        'LiteLLM Model'.padEnd(28) +
        'Auth'.padEnd(12) +
        'Tools'
      );
      console.log('-'.repeat(70));

      models.forEach((model) => {
        const name = (model.model_name || 'unnamed').substring(0, 20).padEnd(22);
        const litellmModel = (model.litellm_params?.model || '').substring(0, 26).padEnd(28);

        let auth = '';
        if (model.litellm_params?.api_key) {
          const envVar = model.litellm_params.api_key.replace('os.environ/', '');
          auth = envVar.includes('OPENAI') ? 'OPENAI' :
                 envVar.includes('MISTRAL') ? 'MISTRAL' :
                 envVar.substring(0, 10);
        } else if (model.litellm_params?.api_base) {
          auth = 'OLLAMA';
        }
        const authStr = auth.padEnd(12);

        const funcCall = model.model_info?.supports_function_calling;
        const funcCallStr = funcCall === true ? '✓' : funcCall === false ? '✗' : '-';

        console.log(name + litellmModel + authStr + funcCallStr);
      });
      console.log();
    };

    printModelTable('CHAT MODELS', chatModels);
    printModelTable('EMBEDDING MODELS', embeddingModels);
    printModelTable('TRANSCRIPTION MODELS', transcriptionModels);
  }

  // Check settings
  if (!config.litellm_settings) {
    warnings.push('litellm_settings section is missing');
  } else {
    console.log('LITELLM SETTINGS');
    console.log('-'.repeat(70));
    Object.entries(config.litellm_settings).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
    console.log();
  }

  if (!config.general_settings) {
    warnings.push('general_settings section is missing');
  } else {
    if (!config.general_settings.master_key) {
      errors.push('general_settings.master_key is missing');
    }
    console.log('GENERAL SETTINGS');
    console.log('-'.repeat(70));
    Object.entries(config.general_settings).forEach(([key, value]) => {
      const displayValue = key === 'master_key' ? '***' : String(value);
      console.log(`  ${key}: ${displayValue}`);
    });
    console.log();
  }

  console.log('='.repeat(70));

  // Print results
  if (errors.length > 0) {
    console.log();
    console.log(`❌ ERRORS (${errors.length}):`);
    errors.forEach((e) => console.log('   • ' + e));
  }

  if (warnings.length > 0) {
    console.log();
    console.log(`⚠️  WARNINGS (${warnings.length}):`);
    warnings.forEach((w) => console.log('   • ' + w));
  }

  if (errors.length === 0) {
    console.log();
    console.log('✅ All model configurations are valid!');
  }

  console.log();
  console.log('='.repeat(70));

  // Exit with error if there are errors
  if (errors.length > 0) {
    process.exit(1);
  }
}

validateConfig();
