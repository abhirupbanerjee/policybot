/**
 * Task Planner Tool
 *
 * Manages multi-step task plans for complex operations.
 * Supports predefined templates and custom task lists.
 * Persists task state to database for progress tracking.
 */

import type { ToolDefinition, ValidationResult } from '../tools';
import { getRequestContext } from '../request-context';
import {
  createTaskPlan,
  getTaskPlan,
  updateTask,
  completePlan,
  cancelPlan,
  calculateStats,
  type Task,
  type TaskStatus,
  type TaskPlan,
  type TaskPlanStats,
} from '../db/task-plans';

// ===== Types =====

interface TaskPlanTemplate {
  title: string;
  tasks: { id: number; description: string }[];
}

interface TaskPlannerArgs {
  action:
    | 'create'
    | 'start_task'
    | 'complete_task'
    | 'fail_task'
    | 'skip_task'
    | 'get_status'
    | 'complete_plan'
    | 'cancel_plan';
  // For create with template:
  template?: 'soe_country_assessment' | 'soe_single_assessment' | 'custom';
  template_variables?: {
    country?: string;
    soe_name?: string;
  };
  // For create with custom:
  title?: string;
  tasks?: { id: number; description: string }[];
  // For update actions:
  plan_id?: string;
  task_id?: number;
  result?: string;
  error?: string;
  reason?: string;
  summary?: string;
}

interface TaskPlannerResponse {
  success: boolean;
  plan_id?: string;
  message: string;
  display: string; // Formatted markdown for LLM to include in response
  stats?: TaskPlanStats;
  error?: string;
}

// ===== Predefined Templates =====

const TASK_TEMPLATES: Record<string, (vars: Record<string, string>) => TaskPlanTemplate> = {
  soe_country_assessment: (vars) => ({
    title: `${vars.country || 'Country'} SOE Assessment`,
    tasks: [
      { id: 1, description: `Identify major SOEs in ${vars.country || 'the country'}` },
      { id: 2, description: 'Search fiscal impact data (2020-2024)' },
      { id: 3, description: 'Apply Pareto filter - top 20% by impact' },
      { id: 4, description: 'Confirm priority SOEs with user' },
      { id: 5, description: 'Collect detailed data for priority SOEs' },
      { id: 6, description: 'Assess SOEs using 6-dimension framework' },
      { id: 7, description: 'Inter-SOE dependency analysis' },
      { id: 8, description: 'Systemic risk assessment' },
      { id: 9, description: 'Generate consolidated report' },
    ],
  }),

  soe_single_assessment: (vars) => ({
    title: `${vars.soe_name || 'SOE'} Assessment`,
    tasks: [
      { id: 1, description: 'Check restructuring history' },
      { id: 2, description: 'Search financial data' },
      { id: 3, description: 'Search operational metrics' },
      { id: 4, description: 'Search governance/audit data' },
      { id: 5, description: 'Search staffing data' },
      { id: 6, description: 'Search inter-SOE relationships' },
      { id: 7, description: 'Score all 6 dimensions' },
      { id: 8, description: 'Evaluate 7 red flags' },
      { id: 9, description: 'Calculate Health Index' },
      { id: 10, description: 'Determine policy pathway' },
      { id: 11, description: 'Generate detailed report' },
    ],
  }),
};

// ===== Formatting Functions =====

function formatPlanCreated(plan: TaskPlan): string {
  const lines = [
    `## ${plan.title}`,
    '',
    `**Plan ID:** \`${plan.id}\``,
    '',
    '| # | Task | Status |',
    '|---|------|--------|',
  ];

  for (const task of plan.tasks) {
    lines.push(`| ${task.id} | ${task.description} | :hourglass: Pending |`);
  }

  lines.push('');
  lines.push(`**Total Tasks:** ${plan.tasks.length}`);

  return lines.join('\n');
}

function formatTaskUpdate(task: Task, stats: TaskPlanStats): string {
  const statusDisplay: Record<TaskStatus, string> = {
    pending: ':hourglass: Pending',
    in_progress: ':arrow_forward: In Progress',
    complete: ':white_check_mark: Complete',
    failed: ':x: Failed',
    skipped: ':fast_forward: Skipped',
  };

  const lines = [
    `${statusDisplay[task.status]} **Task ${task.id}: ${task.description}**`,
  ];

  if (task.status === 'complete' && task.result) {
    lines.push(`> ${task.result}`);
  }
  if (task.status === 'failed' && task.error) {
    lines.push(`> Error: ${task.error}`);
  }
  if (task.status === 'skipped' && task.reason) {
    lines.push(`> Reason: ${task.reason}`);
  }

  lines.push('');
  lines.push(`**Progress:** ${stats.complete}/${stats.total} (${stats.progress_percent}%)`);

  return lines.join('\n');
}

function formatPlanStatus(plan: TaskPlan, stats: TaskPlanStats): string {
  const statusIcons: Record<TaskStatus, string> = {
    pending: ':hourglass:',
    in_progress: ':arrow_forward:',
    complete: ':white_check_mark:',
    failed: ':x:',
    skipped: ':fast_forward:',
  };

  const lines = [
    `## ${plan.title} - Status`,
    '',
    '| # | Task | Status |',
    '|---|------|--------|',
  ];

  for (const task of plan.tasks) {
    const icon = statusIcons[task.status];
    lines.push(`| ${task.id} | ${task.description} | ${icon} |`);
  }

  lines.push('');
  lines.push(`**Progress:** ${stats.complete}/${stats.total} complete (${stats.progress_percent}%)`);

  if (stats.failed > 0) {
    lines.push(`**Failed:** ${stats.failed}`);
  }

  return lines.join('\n');
}

function formatPlanComplete(plan: TaskPlan, stats: TaskPlanStats, summary?: string): string {
  const lines = [
    `## ${plan.title} - Complete`,
    '',
    `:white_check_mark: Completed: ${stats.complete}`,
  ];

  if (stats.failed > 0) lines.push(`:x: Failed: ${stats.failed}`);
  if (stats.skipped > 0) lines.push(`:fast_forward: Skipped: ${stats.skipped}`);

  if (summary) {
    lines.push('');
    lines.push('**Summary:**');
    lines.push(summary);
  }

  return lines.join('\n');
}

// ===== Action Handlers =====

function handleCreate(args: TaskPlannerArgs, threadId: string, userId: string): TaskPlannerResponse {
  let title: string;
  let tasks: { id: number; description: string }[];

  // Use template if specified
  if (args.template && args.template !== 'custom') {
    const templateFn = TASK_TEMPLATES[args.template];
    if (!templateFn) {
      return {
        success: false,
        message: `Unknown template: ${args.template}`,
        display: `:x: Unknown template: ${args.template}`,
        error: `Unknown template: ${args.template}`,
      };
    }
    const template = templateFn(args.template_variables || {});
    title = template.title;
    tasks = template.tasks;
  } else {
    // Custom tasks
    if (!args.title || !args.tasks || args.tasks.length === 0) {
      return {
        success: false,
        message: 'Custom plan requires title and tasks',
        display: ':x: Custom plan requires title and tasks',
        error: 'Custom plan requires title and tasks',
      };
    }
    title = args.title;
    tasks = args.tasks;
  }

  const plan = createTaskPlan(threadId, userId, title, tasks);
  const stats = calculateStats(plan.tasks);

  return {
    success: true,
    plan_id: plan.id,
    message: `Created plan with ${tasks.length} tasks`,
    display: formatPlanCreated(plan),
    stats,
  };
}

function handleStartTask(args: TaskPlannerArgs): TaskPlannerResponse {
  if (!args.plan_id || args.task_id === undefined) {
    return {
      success: false,
      message: 'plan_id and task_id are required',
      display: ':x: plan_id and task_id are required',
      error: 'plan_id and task_id are required',
    };
  }

  const plan = updateTask(args.plan_id, args.task_id, 'in_progress');
  if (!plan) {
    return {
      success: false,
      message: 'Plan not found or not active',
      display: `:x: Plan not found: ${args.plan_id}`,
      error: 'Plan not found or not active',
    };
  }

  const task = plan.tasks.find((t) => t.id === args.task_id);
  const stats = calculateStats(plan.tasks);

  return {
    success: true,
    plan_id: plan.id,
    message: `Started task ${args.task_id}`,
    display: formatTaskUpdate(task!, stats),
    stats,
  };
}

function handleCompleteTask(args: TaskPlannerArgs): TaskPlannerResponse {
  if (!args.plan_id || args.task_id === undefined) {
    return {
      success: false,
      message: 'plan_id and task_id are required',
      display: ':x: plan_id and task_id are required',
      error: 'plan_id and task_id are required',
    };
  }

  const plan = updateTask(args.plan_id, args.task_id, 'complete', { result: args.result });
  if (!plan) {
    return {
      success: false,
      message: 'Plan not found or not active',
      display: `:x: Plan not found: ${args.plan_id}`,
      error: 'Plan not found or not active',
    };
  }

  const task = plan.tasks.find((t) => t.id === args.task_id);
  const stats = calculateStats(plan.tasks);

  return {
    success: true,
    plan_id: plan.id,
    message: `Completed task ${args.task_id}`,
    display: formatTaskUpdate(task!, stats),
    stats,
  };
}

function handleFailTask(args: TaskPlannerArgs): TaskPlannerResponse {
  if (!args.plan_id || args.task_id === undefined) {
    return {
      success: false,
      message: 'plan_id and task_id are required',
      display: ':x: plan_id and task_id are required',
      error: 'plan_id and task_id are required',
    };
  }

  const plan = updateTask(args.plan_id, args.task_id, 'failed', { error: args.error });
  if (!plan) {
    return {
      success: false,
      message: 'Plan not found or not active',
      display: `:x: Plan not found: ${args.plan_id}`,
      error: 'Plan not found or not active',
    };
  }

  const task = plan.tasks.find((t) => t.id === args.task_id);
  const stats = calculateStats(plan.tasks);

  return {
    success: true,
    plan_id: plan.id,
    message: `Task ${args.task_id} failed`,
    display: formatTaskUpdate(task!, stats),
    stats,
  };
}

function handleSkipTask(args: TaskPlannerArgs): TaskPlannerResponse {
  if (!args.plan_id || args.task_id === undefined) {
    return {
      success: false,
      message: 'plan_id and task_id are required',
      display: ':x: plan_id and task_id are required',
      error: 'plan_id and task_id are required',
    };
  }

  const plan = updateTask(args.plan_id, args.task_id, 'skipped', { reason: args.reason });
  if (!plan) {
    return {
      success: false,
      message: 'Plan not found or not active',
      display: `:x: Plan not found: ${args.plan_id}`,
      error: 'Plan not found or not active',
    };
  }

  const task = plan.tasks.find((t) => t.id === args.task_id);
  const stats = calculateStats(plan.tasks);

  return {
    success: true,
    plan_id: plan.id,
    message: `Skipped task ${args.task_id}`,
    display: formatTaskUpdate(task!, stats),
    stats,
  };
}

function handleGetStatus(args: TaskPlannerArgs): TaskPlannerResponse {
  if (!args.plan_id) {
    return {
      success: false,
      message: 'plan_id is required',
      display: ':x: plan_id is required',
      error: 'plan_id is required',
    };
  }

  const plan = getTaskPlan(args.plan_id);
  if (!plan) {
    return {
      success: false,
      message: 'Plan not found',
      display: `:x: Plan not found: ${args.plan_id}`,
      error: 'Plan not found',
    };
  }

  const stats = calculateStats(plan.tasks);

  return {
    success: true,
    plan_id: plan.id,
    message: `Plan status: ${stats.complete}/${stats.total} complete`,
    display: formatPlanStatus(plan, stats),
    stats,
  };
}

function handleCompletePlan(args: TaskPlannerArgs): TaskPlannerResponse {
  if (!args.plan_id) {
    return {
      success: false,
      message: 'plan_id is required',
      display: ':x: plan_id is required',
      error: 'plan_id is required',
    };
  }

  const plan = completePlan(args.plan_id, args.summary);
  if (!plan) {
    return {
      success: false,
      message: 'Plan not found',
      display: `:x: Plan not found: ${args.plan_id}`,
      error: 'Plan not found',
    };
  }

  const stats = calculateStats(plan.tasks);

  return {
    success: true,
    plan_id: plan.id,
    message: 'Plan completed',
    display: formatPlanComplete(plan, stats, args.summary),
    stats,
  };
}

function handleCancelPlan(args: TaskPlannerArgs): TaskPlannerResponse {
  if (!args.plan_id) {
    return {
      success: false,
      message: 'plan_id is required',
      display: ':x: plan_id is required',
      error: 'plan_id is required',
    };
  }

  const plan = cancelPlan(args.plan_id, args.reason);
  if (!plan) {
    return {
      success: false,
      message: 'Plan not found',
      display: `:x: Plan not found: ${args.plan_id}`,
      error: 'Plan not found',
    };
  }

  return {
    success: true,
    plan_id: plan.id,
    message: 'Plan cancelled',
    display: `:no_entry: **Plan Cancelled**${args.reason ? `\n\nReason: ${args.reason}` : ''}`,
  };
}

// ===== Tool Definition =====

export const taskPlannerTool: ToolDefinition = {
  name: 'task_planner',
  displayName: 'Task Planner',
  description: `Create and manage multi-step task plans for complex operations.

USE THIS TOOL when the request requires:
- Assessments across multiple entities (countries, SOEs, departments)
- Sequential operations that benefit from progress tracking
- Complex analysis with 3+ distinct steps

DO NOT USE for:
- Simple factual questions ("What is X?")
- Single-step lookups
- Questions that can be answered with one web search

Available templates: soe_country_assessment, soe_single_assessment`,
  category: 'autonomous',

  definition: {
    type: 'function',
    function: {
      name: 'task_planner',
      description: `Create and manage multi-step task plans for complex operations.

USE THIS TOOL when the request requires:
- Assessments across multiple entities (countries, SOEs, departments)
- Sequential operations that benefit from progress tracking
- Complex analysis with 3+ distinct steps

DO NOT USE for:
- Simple factual questions
- Single-step lookups
- Questions answerable with one web search

Available templates:
- soe_country_assessment: Full country SOE assessment with fiscal analysis
- soe_single_assessment: Detailed single SOE health assessment

When using templates, provide the template name and required variables.`,
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: [
              'create',
              'start_task',
              'complete_task',
              'fail_task',
              'skip_task',
              'get_status',
              'complete_plan',
              'cancel_plan',
            ],
            description: 'Action to perform on the task plan',
          },
          template: {
            type: 'string',
            enum: ['soe_country_assessment', 'soe_single_assessment', 'custom'],
            description: 'Predefined task template (or "custom" to provide tasks manually)',
          },
          template_variables: {
            type: 'object',
            properties: {
              country: { type: 'string', description: 'Country name for country assessment' },
              soe_name: { type: 'string', description: 'SOE name for single assessment' },
            },
            description: 'Variables to populate template',
          },
          title: {
            type: 'string',
            description: 'Plan title (for custom template)',
          },
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'number', description: 'Sequential task ID (1, 2, 3...)' },
                description: { type: 'string', description: 'What this task accomplishes' },
              },
              required: ['id', 'description'],
            },
            description: 'List of tasks (for custom template)',
          },
          plan_id: {
            type: 'string',
            description: 'Plan ID (required for all actions except create)',
          },
          task_id: {
            type: 'number',
            description: 'Task ID to update (for task actions)',
          },
          result: {
            type: 'string',
            description: 'Result/output of completed task (for complete_task)',
          },
          error: {
            type: 'string',
            description: 'Error message (for fail_task)',
          },
          reason: {
            type: 'string',
            description: 'Reason for skipping/cancelling',
          },
          summary: {
            type: 'string',
            description: 'Final summary (for complete_plan)',
          },
        },
        required: ['action'],
      },
    },
  },

  defaultConfig: {},

  configSchema: {
    type: 'object',
    properties: {},
  },

  execute: async (args: Record<string, unknown>): Promise<string> => {
    const typedArgs = args as unknown as TaskPlannerArgs;
    const context = getRequestContext();
    const threadId = context.threadId || '';
    const userId = context.userId || '';

    let response: TaskPlannerResponse;

    switch (typedArgs.action) {
      case 'create':
        response = handleCreate(typedArgs, threadId, userId);
        break;
      case 'start_task':
        response = handleStartTask(typedArgs);
        break;
      case 'complete_task':
        response = handleCompleteTask(typedArgs);
        break;
      case 'fail_task':
        response = handleFailTask(typedArgs);
        break;
      case 'skip_task':
        response = handleSkipTask(typedArgs);
        break;
      case 'get_status':
        response = handleGetStatus(typedArgs);
        break;
      case 'complete_plan':
        response = handleCompletePlan(typedArgs);
        break;
      case 'cancel_plan':
        response = handleCancelPlan(typedArgs);
        break;
      default:
        response = {
          success: false,
          message: `Unknown action: ${typedArgs.action}`,
          display: `:x: Unknown action: ${typedArgs.action}`,
          error: `Unknown action: ${typedArgs.action}`,
        };
    }

    return JSON.stringify(response, null, 2);
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  validateConfig: (_config: Record<string, unknown>): ValidationResult => {
    // Task planner has no configurable settings currently
    return { valid: true, errors: [] };
  },
};

export default taskPlannerTool;
