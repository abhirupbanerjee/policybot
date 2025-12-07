/**
 * LiteLLM Connection Test
 *
 * Tests actual API connectivity to configured models.
 * Run: npx tsx scripts/test-litellm-connections.ts
 */

import yaml from 'yaml';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

interface TestResult {
  model: string;
  provider: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
  latency?: number;
}

async function testConnections(): Promise<void> {
  console.log('='.repeat(70));
  console.log('LITELLM CONNECTION TEST');
  console.log('='.repeat(70));
  console.log();

  // Check environment variables
  console.log('ENVIRONMENT CHECK');
  console.log('-'.repeat(70));

  const envVars = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '✓ Set' : '✗ Missing',
    MISTRAL_API_KEY: process.env.MISTRAL_API_KEY ? '✓ Set' : '✗ Missing',
    OLLAMA_API_BASE: process.env.OLLAMA_API_BASE ? '✓ Set' : '✗ Missing (Ollama models will be skipped)',
    LITELLM_MASTER_KEY: process.env.LITELLM_MASTER_KEY ? '✓ Set' : '✗ Missing',
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || 'Not set (direct to OpenAI)',
  };

  Object.entries(envVars).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });
  console.log();

  // Check LiteLLM proxy health
  const litellmUrl = process.env.OPENAI_BASE_URL || 'http://localhost:4000';
  const baseUrl = litellmUrl.replace('/v1', '');

  console.log('LITELLM PROXY CHECK');
  console.log('-'.repeat(70));
  console.log(`  URL: ${baseUrl}`);

  let proxyHealthy = false;
  try {
    const healthResponse = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (healthResponse.ok) {
      console.log('  Status: ✓ Healthy');
      proxyHealthy = true;
    } else {
      console.log(`  Status: ✗ Unhealthy (${healthResponse.status})`);
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.log(`  Status: ✗ Not reachable (${errMsg})`);
    console.log();
    console.log('⚠️  LiteLLM proxy is not running. Start it with:');
    console.log('    docker compose up litellm -d');
    console.log();
    console.log('Falling back to direct API tests...');
  }
  console.log();

  // Load YAML config
  const yamlPath = path.join(process.cwd(), 'litellm-proxy', 'litellm_config.yaml');
  const yamlContent = fs.readFileSync(yamlPath, 'utf-8');
  const config = yaml.parse(yamlContent);

  const results: TestResult[] = [];

  // Test each model
  console.log('MODEL CONNECTION TESTS');
  console.log('-'.repeat(70));

  for (const model of config.model_list) {
    const modelName = model.model_name;
    const litellmModel = model.litellm_params?.model || '';
    const provider = litellmModel.includes('ollama')
      ? 'ollama'
      : litellmModel.includes('mistral')
      ? 'mistral'
      : 'openai';

    // Skip conditions
    if (provider === 'ollama' && !process.env.OLLAMA_API_BASE) {
      results.push({
        model: modelName,
        provider,
        status: 'skip',
        message: 'OLLAMA_API_BASE not set',
      });
      continue;
    }

    // Skip embedding and transcription models for chat test
    if (litellmModel.includes('embed') || litellmModel.includes('whisper') || litellmModel.includes('voxtral')) {
      results.push({
        model: modelName,
        provider,
        status: 'skip',
        message: 'Non-chat model (embedding/transcription)',
      });
      continue;
    }

    // Test chat completion
    const startTime = Date.now();
    try {
      let response: Response;

      if (proxyHealthy) {
        // Test via LiteLLM proxy
        response = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.LITELLM_MASTER_KEY}`,
          },
          body: JSON.stringify({
            model: modelName,
            messages: [{ role: 'user', content: 'Say "OK" and nothing else.' }],
            max_tokens: 5,
          }),
          signal: AbortSignal.timeout(30000),
        });
      } else {
        // Test directly (only OpenAI)
        if (provider !== 'openai') {
          results.push({
            model: modelName,
            provider,
            status: 'skip',
            message: 'Proxy not running, direct test only for OpenAI',
          });
          continue;
        }

        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: litellmModel,
            messages: [{ role: 'user', content: 'Say "OK" and nothing else.' }],
            max_tokens: 5,
          }),
          signal: AbortSignal.timeout(30000),
        });
      }

      const latency = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        results.push({
          model: modelName,
          provider,
          status: 'pass',
          message: `Response: "${content.trim()}"`,
          latency,
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || `HTTP ${response.status}`;
        results.push({
          model: modelName,
          provider,
          status: 'fail',
          message: errorMsg.substring(0, 50),
          latency,
        });
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      const errMsg = error instanceof Error ? error.message : String(error);
      results.push({
        model: modelName,
        provider,
        status: 'fail',
        message: errMsg.substring(0, 50),
        latency,
      });
    }
  }

  // Print results
  console.log('Model'.padEnd(22) + 'Provider'.padEnd(10) + 'Status'.padEnd(8) + 'Latency'.padEnd(10) + 'Details');
  console.log('-'.repeat(70));

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  results.forEach((r) => {
    const statusIcon = r.status === 'pass' ? '✓' : r.status === 'fail' ? '✗' : '○';
    const latencyStr = r.latency ? `${r.latency}ms` : '-';
    console.log(
      r.model.substring(0, 20).padEnd(22) +
        r.provider.padEnd(10) +
        statusIcon.padEnd(8) +
        latencyStr.padEnd(10) +
        r.message.substring(0, 30)
    );

    if (r.status === 'pass') passed++;
    else if (r.status === 'fail') failed++;
    else skipped++;
  });

  console.log();
  console.log('='.repeat(70));
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log('='.repeat(70));

  if (failed > 0) {
    process.exit(1);
  }
}

testConnections().catch(console.error);
