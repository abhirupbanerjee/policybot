/**
 * Streaming Autonomous Executor
 *
 * Integrates autonomous mode with SSE streaming for real-time progress updates
 */

// @ts-nocheck - Type compatibility issues will be resolved in future refactor
import type { StreamEvent } from '@/types/stream';
import type { AgentModelConfig, AgentPlan, AgentTask, ExecutionResult } from '@/types/agent';
import { createAndExecuteAutonomousPlan } from './orchestrator';
import { getAgentModelConfigs } from '../db/agent-config';

/**
 * Execute autonomous plan with streaming progress updates
 *
 * @param userRequest - The user's autonomous mode request
 * @param context - Additional context (RAG, conversation history, etc.)
 * @param planConfig - Plan configuration (thread/user IDs, budget, model config)
 * @param sendEvent - Callback to send SSE events to client
 * @returns Final assistant response content
 */
export async function executeAutonomousWithStreaming(
  userRequest: string,
  context: {
    ragContext?: string;
    conversationHistory?: string;
    categoryContext?: string;
  },
  planConfig: {
    threadId: string;
    userId: string;
    categorySlug?: string;
    budget?: Record<string, unknown>;
  },
  sendEvent: (event: StreamEvent) => void
): Promise<string> {
  // Get model config from database (admin-configured)
  const modelConfigs = getAgentModelConfigs();
  const modelConfig: AgentModelConfig = {
    planner: modelConfigs.planner,
    executor: modelConfigs.executor,
    checker: modelConfigs.checker,
    summarizer: modelConfigs.summarizer,
  };

  // Execute autonomous plan with streaming callbacks
  try {
    sendEvent({ type: 'status', phase: 'agent_planning', content: 'Creating autonomous task plan...' });

    const result = await createAndExecuteAutonomousPlan(
      userRequest,
      context,
      {
        threadId: planConfig.threadId,
        userId: planConfig.userId,
        categorySlug: planConfig.categorySlug,
        budget: planConfig.budget,
        modelConfig,
      },
      {
        onPlanCreated: (plan: AgentPlan) => {
          sendEvent({
            type: 'agent_plan_created',
            plan_id: plan.id,
            title: plan.title,
            task_count: plan.tasks.length,
          });
          sendEvent({
            type: 'status',
            phase: 'agent_executing',
            content: `Executing ${plan.tasks.length} tasks...`,
          });
        },

        onTaskStarted: (task: AgentTask) => {
          sendEvent({
            type: 'agent_task_started',
            task_id: task.id,
            description: task.description,
            type: task.type,
          });
        },

        onTaskCompleted: (task: AgentTask, result: ExecutionResult) => {
          const status = result.success
            ? 'done'
            : result.skipped
              ? 'skipped'
              : result.needsReview
                ? 'needs_review'
                : 'done';

          sendEvent({
            type: 'agent_task_completed',
            task_id: task.id,
            status,
            confidence: result.confidence,
          });
        },

        onBudgetWarning: (message: string, percentage: number) => {
          const level = percentage >= 75 ? 'high' : 'medium';
          sendEvent({
            type: 'agent_budget_warning',
            level,
            percentage,
            message,
          });
        },

        onBudgetExceeded: (message: string) => {
          sendEvent({
            type: 'agent_budget_exceeded',
            message,
          });
        },

        onError: (error: string) => {
          sendEvent({
            type: 'agent_error',
            error,
          });
        },

        onPlanCompleted: (plan: AgentPlan, summary: string) => {
          sendEvent({ type: 'status', phase: 'agent_summarizing', content: 'Generating summary...' });

          // Calculate stats
          const stats = {
            total_tasks: plan.tasks.length,
            completed_tasks: plan.tasks.filter((t) => t.status === 'done').length,
            failed_tasks: plan.tasks.filter((t) => t.status === 'failed').length,
            skipped_tasks: plan.tasks.filter((t) => t.status === 'skipped').length,
            needs_review_tasks: plan.tasks.filter((t) => t.status === 'needs_review').length,
            average_confidence:
              plan.tasks
                .filter((t) => t.confidence_score !== undefined)
                .reduce((sum, t) => sum + (t.confidence_score || 0), 0) /
                plan.tasks.filter((t) => t.confidence_score !== undefined).length || 0,
          };

          sendEvent({
            type: 'agent_plan_summary',
            summary,
            stats,
          });
        },
      }
    );

    if (result.success && result.summary) {
      return result.summary;
    } else if (result.error) {
      throw new Error(result.error);
    } else {
      throw new Error('Autonomous execution failed with unknown error');
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    sendEvent({
      type: 'agent_error',
      error: errorMsg,
    });
    throw error;
  }
}
