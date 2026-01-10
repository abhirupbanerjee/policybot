/**
 * Checker Agent
 *
 * Quality validation agent that evaluates task results
 * - Auto-approves at ≥80% confidence
 * - Flags for review at <80%
 * - Never auto-approves on parse failure
 * - Skips quality check for summarize tasks
 */

import type { AgentTask, CheckerResult, AgentModelConfig } from '@/types/agent';
import { generateWithModel, getModelForRole } from './llm-router';
import { parseCheckerResponse } from './json-parser';

// Confidence threshold from database settings
const DEFAULT_CONFIDENCE_THRESHOLD = 80;

/**
 * Check task quality and return confidence score
 *
 * @param task - The task to check
 * @param result - The task result to evaluate
 * @param modelConfig - Model configuration for agent roles
 * @returns Checker result with approval status and confidence score
 */
export async function checkTaskQuality(
  task: AgentTask,
  result: string,
  modelConfig: AgentModelConfig
): Promise<CheckerResult> {
  // Auto-approve summarize tasks (as per plan requirements)
  if (task.type === 'summarize') {
    return {
      status: 'approved',
      confidence_score: 100,
      notes: 'Summary tasks auto-approved',
      tokens_used: 0,
    };
  }

  // Get confidence threshold from settings
  const { getSetting } = await import('../db/config');
  const threshold = parseInt(getSetting('agent_confidence_threshold', String(DEFAULT_CONFIDENCE_THRESHOLD)), 10);

  // Build evaluation prompt
  const prompt = buildEvaluationPrompt(task, result, threshold);

  try {
    // Get checker model
    const checkerModel = getModelForRole('checker', modelConfig);

    // Generate evaluation
    const response = await generateWithModel(checkerModel, prompt, {
      systemPrompt: 'You are a quality checker. Evaluate task results objectively and provide confidence scores.',
      temperature: 0.2, // Low temperature for consistency
    });

    // Parse response with schema validation
    const parseResult = await parseCheckerResponse(response.content, checkerModel);

    // CRITICAL: Never auto-approve on parse failure
    if (!parseResult.success) {
      console.error('[Checker] Parse failed:', parseResult.error);
      return {
        status: 'needs_review',
        confidence_score: 0,
        notes: `Parse failed, manual review needed: ${parseResult.error}`,
        tokens_used: response.tokens_used,
      };
    }

    // Extract confidence and notes
    const { confidence, notes } = parseResult.data;

    // Auto-approve if >= threshold
    if (confidence >= threshold) {
      return {
        status: 'approved',
        confidence_score: confidence,
        notes: notes || 'Meets quality threshold',
        tokens_used: response.tokens_used,
      };
    }

    // Needs review if < threshold
    return {
      status: 'needs_review',
      confidence_score: confidence,
      notes: notes || `Confidence ${confidence}% below threshold ${threshold}%`,
      tokens_used: response.tokens_used,
    };
  } catch (error) {
    // NEVER auto-approve on error
    console.error('[Checker] Error during quality check:', error);
    return {
      status: 'needs_review',
      confidence_score: 0,
      notes: `Checker error: ${error instanceof Error ? error.message : String(error)}`,
      tokens_used: 0,
    };
  }
}

/**
 * Build evaluation prompt for the checker
 */
function buildEvaluationPrompt(task: AgentTask, result: string, threshold: number): string {
  return `Evaluate this task result quality on a scale of 0-100% confidence.

**Task Details:**
- Type: ${task.type}
- Target: ${task.target}
- Description: ${task.description}

**Task Result:**
${result || '(No result provided)'}

**Evaluation Criteria:**
- Completeness: Does the result fully address the task?
- Accuracy: Is the information correct and reliable?
- Relevance: Is the result relevant to the task target?
- Quality: Is the result well-structured and clear?

**Confidence Threshold:** ${threshold}%
- ≥${threshold}%: Task will be auto-approved
- <${threshold}%: Task will be flagged for manual review

Respond with JSON only:
{
  "confidence": 85,
  "notes": "Brief explanation of the confidence score"
}`;
}

/**
 * Batch check multiple tasks (for efficiency)
 */
export async function batchCheckTasks(
  tasks: Array<{ task: AgentTask; result: string }>,
  modelConfig: AgentModelConfig
): Promise<CheckerResult[]> {
  const results: CheckerResult[] = [];

  // Process tasks sequentially (parallel could be added later)
  for (const { task, result } of tasks) {
    try {
      const checkResult = await checkTaskQuality(task, result, modelConfig);
      results.push(checkResult);
    } catch (error) {
      // On error, flag for review
      results.push({
        status: 'needs_review',
        confidence_score: 0,
        notes: `Batch check error: ${error instanceof Error ? error.message : String(error)}`,
        tokens_used: 0,
      });
    }
  }

  return results;
}
