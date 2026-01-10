/**
 * Summarizer Agent
 *
 * Generates final summaries of completed plans
 * Consolidates all task results into a coherent summary
 */

import type { AgentPlan, AgentModelConfig } from '@/types/agent';
import { generateWithModel, getModelForRole } from './llm-router';

/**
 * Generate summary of completed plan
 *
 * @param plan - The completed plan
 * @param modelConfig - Model configuration
 * @returns Summary text and token usage
 */
export async function generateSummary(
  plan: AgentPlan,
  modelConfig: AgentModelConfig
): Promise<{ summary: string; tokens_used: number }> {
  const prompt = buildSummaryPrompt(plan);

  try {
    // Get summarizer model
    const summarizerModel = getModelForRole('summarizer', modelConfig);

    // Generate summary
    const response = await generateWithModel(summarizerModel, prompt, {
      systemPrompt: SUMMARIZER_SYSTEM_PROMPT,
      temperature: 0.5, // Moderate creativity for natural language
    });

    return {
      summary: response.content,
      tokens_used: response.tokens_used,
    };
  } catch (error) {
    console.error('[Summarizer] Error generating summary:', error);
    return {
      summary: generateFallbackSummary(plan),
      tokens_used: 0,
    };
  }
}

/**
 * Build summary prompt
 */
function buildSummaryPrompt(plan: AgentPlan): string {
  let prompt = `Generate a comprehensive summary of this completed autonomous plan.

**Plan:** ${plan.title}
**Original Request:** ${plan.original_request}

**Task Results:**
`;

  // Add all completed task results
  for (const task of plan.tasks) {
    const statusEmoji =
      task.status === 'done'
        ? '✓'
        : task.status === 'skipped'
          ? '⊘'
          : task.status === 'needs_review'
            ? '⚠'
            : '✗';

    prompt += `\n${statusEmoji} Task ${task.id}: ${task.description}\n`;

    if (task.status === 'done' && task.result) {
      prompt += `  Result: ${task.result}\n`;
      if (task.confidence_score !== undefined) {
        prompt += `  Confidence: ${task.confidence_score}%\n`;
      }
    } else if (task.status === 'skipped' && task.error) {
      prompt += `  Skipped: ${task.error}\n`;
    } else if (task.status === 'needs_review') {
      prompt += `  Needs Review: ${task.review_notes || 'Low confidence'}\n`;
      if (task.result) {
        prompt += `  Result: ${task.result.substring(0, 200)}...\n`;
      }
    }
  }

  // Add statistics
  if (plan.stats) {
    prompt += `\n**Statistics:**
- Total Tasks: ${plan.stats.total_tasks}
- Completed: ${plan.stats.completed_tasks}
- Failed/Skipped: ${plan.stats.failed_tasks + plan.stats.skipped_tasks}
- Needs Review: ${plan.stats.needs_review_tasks}
- Average Confidence: ${plan.stats.average_confidence.toFixed(1)}%
`;
  }

  prompt += `\n**Instructions:**
1. Summarize what was accomplished
2. Highlight key findings or results
3. Note any tasks that need review or failed
4. Provide actionable next steps if applicable
5. Keep the summary concise (2-4 paragraphs)

Write in a clear, professional tone.`;

  return prompt;
}

/**
 * Generate fallback summary if LLM fails
 */
function generateFallbackSummary(plan: AgentPlan): string {
  const completed = plan.tasks.filter((t) => t.status === 'done').length;
  const skipped = plan.tasks.filter((t) => t.status === 'skipped').length;
  const needsReview = plan.tasks.filter((t) => t.status === 'needs_review').length;
  const failed = plan.tasks.filter((t) => t.status === 'failed').length;

  let summary = `# ${plan.title}\n\n`;
  summary += `Completed ${completed} of ${plan.tasks.length} tasks`;

  if (skipped > 0) summary += `, ${skipped} skipped`;
  if (needsReview > 0) summary += `, ${needsReview} need review`;
  if (failed > 0) summary += `, ${failed} failed`;

  summary += '.\n\n**Completed Tasks:**\n';

  for (const task of plan.tasks.filter((t) => t.status === 'done')) {
    summary += `- ${task.description}`;
    if (task.confidence_score) {
      summary += ` (${task.confidence_score}% confidence)`;
    }
    summary += '\n';
  }

  if (needsReview > 0) {
    summary += '\n**Tasks Needing Review:**\n';
    for (const task of plan.tasks.filter((t) => t.status === 'needs_review')) {
      summary += `- ${task.description}: ${task.review_notes || 'Low confidence'}\n`;
    }
  }

  return summary;
}

/**
 * System prompt for the summarizer agent
 */
const SUMMARIZER_SYSTEM_PROMPT = `You are a summary generation agent. You create clear, comprehensive summaries of completed task plans.

Key principles:
- Synthesize information from multiple tasks
- Highlight key accomplishments and findings
- Note any issues or tasks needing review
- Provide actionable insights
- Write in a professional, clear style

Output your summary in markdown format.`;
