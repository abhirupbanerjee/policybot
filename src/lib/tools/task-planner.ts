/**
 * Task Planner Tool
 *
 * Manages multi-step task plans for complex operations.
 * Persists task state to database for progress tracking.
 *
 * Templates can be defined per category via category_tool_configs.
 * The LLM can use templates or provide explicit title/tasks.
 */

import type { ToolDefinition, ValidationResult } from '../tools';
import { getRequestContext } from '../request-context';
import { getEffectiveToolConfig } from '../db/category-tool-config';
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

// ===== Template Types =====

interface TaskTemplate {
  name: string;
  description: string;
  active: boolean;
  placeholders: string[];
  tasks: Array<{
    id: number;
    description: string;
  }>;
  createdBy?: string;
  updatedBy?: string;
  updatedAt?: string;
}

interface TaskPlannerCategoryConfig {
  templates?: Record<string, TaskTemplate>;
}

// ===== Types =====

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
  template?: string;
  template_variables?: Record<string, string>;
  // For create without template:
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

// ===== Helper Functions =====

/**
 * Replace {placeholder} tokens in text with provided values
 */
function replacePlaceholders(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, key) => vars[key] || `{${key}}`);
}

/**
 * Get available templates for a category from config
 */
function getTemplatesForCategory(categoryId: number): Record<string, TaskTemplate> | null {
  const { config } = getEffectiveToolConfig('task_planner', categoryId);
  if (!config) return null;

  const categoryConfig = config as TaskPlannerCategoryConfig;
  return categoryConfig.templates || null;
}

// ===== Action Handlers =====

function handleCreate(
  args: TaskPlannerArgs,
  threadId: string,
  userId: string,
  categoryId?: number
): TaskPlannerResponse {
  let title: string;
  let tasks: { id: number; description: string }[];

  // If template specified, look it up from category config
  if (args.template) {
    if (!categoryId) {
      return {
        success: false,
        message: 'Template requires category context',
        display: ':x: Template requires category context',
        error: 'Template requires category context',
      };
    }

    const templates = getTemplatesForCategory(categoryId);
    if (!templates) {
      return {
        success: false,
        message: 'No templates configured for this category',
        display: ':x: No templates configured for this category',
        error: 'No templates configured for this category',
      };
    }

    const template = templates[args.template];
    if (!template) {
      const availableTemplates = Object.keys(templates).join(', ');
      return {
        success: false,
        message: `Template not found: ${args.template}`,
        display: `:x: Template not found: ${args.template}. Available: ${availableTemplates}`,
        error: `Template not found: ${args.template}`,
      };
    }

    if (!template.active) {
      return {
        success: false,
        message: `Template is inactive: ${args.template}`,
        display: `:x: Template is inactive: ${args.template}`,
        error: `Template is inactive: ${args.template}`,
      };
    }

    // Replace placeholders in task descriptions
    const templateVars = args.template_variables || {};
    tasks = template.tasks.map((t) => ({
      id: t.id,
      description: replacePlaceholders(t.description, templateVars),
    }));
    title = replacePlaceholders(template.name, templateVars);
  } else {
    // Require explicit title and tasks
    if (!args.title || !args.tasks || args.tasks.length === 0) {
      return {
        success: false,
        message: 'Plan requires title and tasks, or a template',
        display: ':x: Plan requires title and tasks, or a template',
        error: 'Plan requires title and tasks, or a template',
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
  description: 'Create and manage multi-step task plans for complex operations.',
  category: 'autonomous',

  definition: {
    type: 'function',
    function: {
      name: 'task_planner',
      description: 'Create and manage multi-step task plans for complex operations.',
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
            description: 'Template name from category config (for create action)',
          },
          template_variables: {
            type: 'object',
            additionalProperties: { type: 'string' },
            description: 'Placeholder values for template (e.g., {"country": "Jamaica"})',
          },
          title: {
            type: 'string',
            description: 'Plan title (required for create if no template)',
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
            description: 'List of tasks (required for create if no template)',
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
    const categoryId = context.categoryId;

    let response: TaskPlannerResponse;

    switch (typedArgs.action) {
      case 'create':
        response = handleCreate(typedArgs, threadId, userId, categoryId);
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
