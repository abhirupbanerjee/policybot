/**
 * Task Plans Database Operations
 *
 * CRUD operations for the task_plans table.
 * Supports the Task Planner tool for managing multi-step task workflows.
 */

import { nanoid } from 'nanoid';
import { execute, queryOne, queryAll } from './index';

// ============ Types ============

export type TaskStatus = 'pending' | 'in_progress' | 'complete' | 'failed' | 'skipped';
export type PlanStatus = 'active' | 'completed' | 'cancelled' | 'failed';

export interface Task {
  id: number;
  description: string;
  status: TaskStatus;
  result?: string;
  error?: string;
  reason?: string;
  started_at?: string;
  completed_at?: string;
}

export interface TaskPlan {
  id: string;
  threadId: string;
  userId: string;
  categorySlug?: string;
  title: string;
  tasks: Task[];
  status: PlanStatus;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface TaskPlanStats {
  total: number;
  pending: number;
  in_progress: number;
  complete: number;
  failed: number;
  skipped: number;
  progress_percent: number;
}

// Database row type
interface DbTaskPlan {
  id: string;
  thread_id: string;
  user_id: string;
  category_slug: string | null;
  title: string | null;
  tasks_json: string;
  status: string;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

// ============ Mappers ============

function mapDbToTaskPlan(row: DbTaskPlan): TaskPlan {
  const tasksData = JSON.parse(row.tasks_json) as { tasks: Task[] };
  return {
    id: row.id,
    threadId: row.thread_id,
    userId: row.user_id,
    categorySlug: row.category_slug || undefined,
    title: row.title || 'Task Plan',
    tasks: tasksData.tasks,
    status: row.status as PlanStatus,
    totalTasks: row.total_tasks,
    completedTasks: row.completed_tasks,
    failedTasks: row.failed_tasks,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at || undefined,
  };
}

// ============ Stats Calculation ============

export function calculateStats(tasks: Task[]): TaskPlanStats {
  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    complete: tasks.filter((t) => t.status === 'complete').length,
    failed: tasks.filter((t) => t.status === 'failed').length,
    skipped: tasks.filter((t) => t.status === 'skipped').length,
    progress_percent: 0,
  };

  const finished = stats.complete + stats.failed + stats.skipped;
  stats.progress_percent = stats.total > 0 ? Math.round((finished / stats.total) * 100) : 0;

  return stats;
}

// ============ CRUD Operations ============

/**
 * Create a new task plan
 */
export function createTaskPlan(
  threadId: string,
  userId: string,
  title: string,
  tasks: { id: number; description: string }[],
  categorySlug?: string
): TaskPlan {
  const id = `plan_${nanoid(12)}`;
  const now = new Date().toISOString();

  const fullTasks: Task[] = tasks.map((t) => ({
    id: t.id,
    description: t.description,
    status: 'pending' as TaskStatus,
  }));

  const tasksJson = JSON.stringify({ tasks: fullTasks });

  execute(
    `INSERT INTO task_plans (
      id, thread_id, user_id, category_slug, title, tasks_json,
      status, total_tasks, completed_tasks, failed_tasks,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, 0, 0, ?, ?)`,
    [id, threadId, userId, categorySlug || null, title, tasksJson, tasks.length, now, now]
  );

  return getTaskPlan(id)!;
}

/**
 * Get a task plan by ID
 */
export function getTaskPlan(planId: string): TaskPlan | undefined {
  const row = queryOne<DbTaskPlan>('SELECT * FROM task_plans WHERE id = ?', [planId]);
  return row ? mapDbToTaskPlan(row) : undefined;
}

/**
 * Get active task plan for a thread (most recent active plan)
 */
export function getActiveTaskPlan(threadId: string): TaskPlan | undefined {
  const row = queryOne<DbTaskPlan>(
    `SELECT * FROM task_plans
     WHERE thread_id = ? AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    [threadId]
  );
  return row ? mapDbToTaskPlan(row) : undefined;
}

/**
 * Get all task plans for a thread
 */
export function getTaskPlansByThread(threadId: string): TaskPlan[] {
  const rows = queryAll<DbTaskPlan>(
    'SELECT * FROM task_plans WHERE thread_id = ? ORDER BY created_at DESC',
    [threadId]
  );
  return rows.map(mapDbToTaskPlan);
}

/**
 * Get all task plans for a user
 */
export function getTaskPlansByUser(userId: string, limit: number = 50): TaskPlan[] {
  const rows = queryAll<DbTaskPlan>(
    'SELECT * FROM task_plans WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [userId, limit]
  );
  return rows.map(mapDbToTaskPlan);
}

/**
 * Update a task's status within a plan
 */
export function updateTask(
  planId: string,
  taskId: number,
  status: TaskStatus,
  extras?: { result?: string; error?: string; reason?: string }
): TaskPlan | undefined {
  const plan = getTaskPlan(planId);
  if (!plan || plan.status !== 'active') return undefined;

  const task = plan.tasks.find((t) => t.id === taskId);
  if (!task) return undefined;

  const now = new Date().toISOString();

  // Update task
  task.status = status;
  if (status === 'in_progress') {
    task.started_at = now;
  }
  if (status === 'complete' || status === 'failed' || status === 'skipped') {
    task.completed_at = now;
  }
  if (extras?.result) task.result = extras.result;
  if (extras?.error) task.error = extras.error;
  if (extras?.reason) task.reason = extras.reason;

  // Calculate stats
  const stats = calculateStats(plan.tasks);

  // Update database
  execute(
    `UPDATE task_plans
     SET tasks_json = ?, updated_at = ?, completed_tasks = ?, failed_tasks = ?
     WHERE id = ?`,
    [JSON.stringify({ tasks: plan.tasks }), now, stats.complete, stats.failed, planId]
  );

  return getTaskPlan(planId);
}

/**
 * Complete a task plan
 */
export function completePlan(planId: string, summary?: string): TaskPlan | undefined {
  const plan = getTaskPlan(planId);
  if (!plan) return undefined;

  const now = new Date().toISOString();

  // If summary provided, store it in the last task's result or create a summary task
  if (summary) {
    const lastTask = plan.tasks[plan.tasks.length - 1];
    if (lastTask && !lastTask.result) {
      lastTask.result = summary;
    }
  }

  execute(
    `UPDATE task_plans
     SET status = 'completed', tasks_json = ?, updated_at = ?, completed_at = ?
     WHERE id = ?`,
    [JSON.stringify({ tasks: plan.tasks }), now, now, planId]
  );

  return getTaskPlan(planId);
}

/**
 * Cancel a task plan
 */
export function cancelPlan(planId: string, reason?: string): TaskPlan | undefined {
  const plan = getTaskPlan(planId);
  if (!plan) return undefined;

  const now = new Date().toISOString();

  // Mark all pending tasks as skipped
  for (const task of plan.tasks) {
    if (task.status === 'pending' || task.status === 'in_progress') {
      task.status = 'skipped';
      task.reason = reason || 'Plan cancelled';
      task.completed_at = now;
    }
  }

  execute(
    `UPDATE task_plans
     SET status = 'cancelled', tasks_json = ?, updated_at = ?
     WHERE id = ?`,
    [JSON.stringify({ tasks: plan.tasks }), now, planId]
  );

  return getTaskPlan(planId);
}

/**
 * Fail a task plan
 */
export function failPlan(planId: string, error: string): TaskPlan | undefined {
  const plan = getTaskPlan(planId);
  if (!plan) return undefined;

  const now = new Date().toISOString();

  // Mark all pending tasks as skipped due to failure
  for (const task of plan.tasks) {
    if (task.status === 'pending' || task.status === 'in_progress') {
      task.status = 'skipped';
      task.reason = `Plan failed: ${error}`;
      task.completed_at = now;
    }
  }

  execute(
    `UPDATE task_plans
     SET status = 'failed', tasks_json = ?, updated_at = ?
     WHERE id = ?`,
    [JSON.stringify({ tasks: plan.tasks }), now, planId]
  );

  return getTaskPlan(planId);
}

/**
 * Delete a task plan (hard delete)
 */
export function deleteTaskPlan(planId: string): boolean {
  const result = execute('DELETE FROM task_plans WHERE id = ?', [planId]);
  return result.changes > 0;
}

/**
 * Clean up old completed/cancelled/failed plans
 */
export function cleanupOldPlans(daysOld: number = 30): number {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = execute(
    `DELETE FROM task_plans
     WHERE status IN ('completed', 'cancelled', 'failed')
     AND updated_at < ?`,
    [cutoffDate.toISOString()]
  );

  return result.changes;
}
