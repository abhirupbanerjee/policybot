/**
 * Executor Agent
 *
 * Executes tasks with:
 * - Idempotency (crash-recoverable)
 * - Fail-fast (no retries)
 * - Task timeout enforcement
 * - Quality checking (80% threshold)
 */

import type { AgentTask, AgentPlan, ExecutionResult, AgentModelConfig } from '@/types/agent';
import { generateWithModel, getModelForRole } from './llm-router';
import { checkTaskQuality } from './checker';
import { transitionTaskState, incrementBudgetUsage } from '../db/task-plans';

/**
 * Execute a single task
 *
 * @param task - The task to execute
 * @param plan - The parent plan (for context and budget tracking)
 * @param modelConfig - Model configuration
 * @returns Execution result
 */
export async function executeTask(
  task: AgentTask,
  plan: AgentPlan,
  modelConfig: AgentModelConfig
): Promise<ExecutionResult> {
  // Check if already executed (idempotency)
  if (task.status !== 'pending') {
    return {
      success: true,
      skipReason: `Task already ${task.status}`,
    };
  }

  // Mark as running and save state history
  try {
    transitionTaskState(plan.id, task.id, 'running');
  } catch (error) {
    return {
      success: false,
      error: `Failed to transition to running: ${error instanceof Error ? error.message : String(error)}`,
      skipped: true,
    };
  }

  try {
    // Perform task execution
    const result = await performTaskExecution(task, plan, modelConfig);

    // Track LLM usage
    if (result.tokens_used) {
      incrementBudgetUsage(plan.id, {
        llm_calls: result.llm_calls || 1,
        tokens_used: result.tokens_used,
      });
    }

    // Quality check with 80% threshold
    const checkResult = await checkTaskQuality(task, result.content, modelConfig);

    // Track checker LLM usage
    if (checkResult.tokens_used) {
      incrementBudgetUsage(plan.id, {
        llm_calls: 1,
        tokens_used: checkResult.tokens_used,
      });
    }

    // Handle check result
    if (checkResult.status === 'approved') {
      // Auto-approved
      transitionTaskState(plan.id, task.id, 'done', {
        result: result.content,
        confidence_score: checkResult.confidence_score,
        tokens_used: result.tokens_used,
        llm_calls: result.llm_calls,
      });

      return {
        success: true,
        result: result.content,
        confidence: checkResult.confidence_score,
        tokens_used: result.tokens_used,
        llm_calls: result.llm_calls,
      };
    } else {
      // Low confidence - mark as needs_review
      transitionTaskState(plan.id, task.id, 'needs_review', {
        result: result.content,
        confidence_score: checkResult.confidence_score,
        review_notes: checkResult.notes,
        tokens_used: result.tokens_used,
        llm_calls: result.llm_calls,
      });

      return {
        success: false,
        needsReview: true,
        result: result.content,
        confidence: checkResult.confidence_score,
        tokens_used: result.tokens_used,
        llm_calls: result.llm_calls,
      };
    }
  } catch (error) {
    // FAIL-FAST: No retries, skip on first failure
    const errorMsg = error instanceof Error ? error.message : String(error);

    transitionTaskState(plan.id, task.id, 'skipped', {
      error: errorMsg,
    });

    return {
      success: false,
      error: errorMsg,
      skipped: true,
    };
  }
}

/**
 * Perform actual task execution (LLM call)
 */
async function performTaskExecution(
  task: AgentTask,
  plan: AgentPlan,
  modelConfig: AgentModelConfig
): Promise<{ content: string; tokens_used?: number; llm_calls?: number }> {
  const prompt = buildExecutionPrompt(task, plan);

  // Get executor model
  const executorModel = getModelForRole('executor', modelConfig);

  // Generate result
  const response = await generateWithModel(executorModel, prompt, {
    systemPrompt: EXECUTOR_SYSTEM_PROMPT,
    temperature: 0.4, // Balanced creativity
  });

  return {
    content: response.content,
    tokens_used: response.tokens_used,
    llm_calls: 1,
  };
}

/**
 * Build execution prompt for the executor
 */
function buildExecutionPrompt(task: AgentTask, plan: AgentPlan): string {
  let prompt = `Execute this task as part of a larger plan.

**Plan:** ${plan.title}
**Original Request:** ${plan.original_request}

**Task to Execute:**
- ID: ${task.id}
- Type: ${task.type}
- Target: ${task.target}
- Description: ${task.description}
`;

  // Add results from dependent tasks
  if (task.dependencies.length > 0) {
    prompt += `\n**Dependencies (already completed):**\n`;
    for (const depId of task.dependencies) {
      const dep = plan.tasks.find((t) => t.id === depId);
      if (dep && dep.result) {
        prompt += `- Task ${depId}: ${dep.description}\n  Result: ${dep.result.substring(0, 200)}...\n`;
      }
    }
  }

  prompt += `\n**Instructions:**
Execute the task based on the type:
- **analyze**: Examine and interpret the information
- **search**: Find relevant information (explain what you would search for)
- **compare**: Compare the items and highlight key differences
- **generate**: Create the requested content
- **summarize**: Provide a concise summary
- **extract**: Pull out the specific information requested
- **validate**: Check correctness and flag any issues

Provide a clear, actionable result.`;

  return prompt;
}

/**
 * System prompt for the executor agent
 */
const EXECUTOR_SYSTEM_PROMPT = `You are a task execution agent. You complete specific tasks as part of a larger plan.

Key principles:
- Follow the task type and description precisely
- Provide clear, actionable results
- Reference dependent task results when relevant
- Be concise but thorough
- If information is missing, explain what's needed

Output your result directly without JSON formatting.`;
