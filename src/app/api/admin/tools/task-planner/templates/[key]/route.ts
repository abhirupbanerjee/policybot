/**
 * Admin Task Planner Template API - Individual template operations
 *
 * GET    /api/admin/tools/task-planner/templates/[key]?categoryId=X - Get a template
 * PATCH  /api/admin/tools/task-planner/templates/[key] - Update a template
 * DELETE /api/admin/tools/task-planner/templates/[key]?categoryId=X - Delete a template (Admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireElevated } from '@/lib/auth';
import {
  getCategoryToolConfig,
  upsertCategoryToolConfig,
} from '@/lib/db/category-tool-config';
import { getCategoryById } from '@/lib/db/categories';

interface TaskTemplate {
  name: string;
  description: string;
  active: boolean;
  placeholders: string[];
  tasks: Array<{ id: number; description: string }>;
  createdBy?: string;
  updatedBy?: string;
  updatedAt?: string;
}

interface TaskPlannerConfig {
  templates?: Record<string, TaskTemplate>;
}

interface RouteParams {
  params: Promise<{ key: string }>;
}

/**
 * GET /api/admin/tools/task-planner/templates/[key]
 * Get a specific template
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireElevated();

    const { key } = await params;
    const { searchParams } = new URL(request.url);
    const categoryIdParam = searchParams.get('categoryId');

    if (!categoryIdParam) {
      return NextResponse.json(
        { error: 'categoryId is required' },
        { status: 400 }
      );
    }

    const categoryId = parseInt(categoryIdParam, 10);
    if (isNaN(categoryId)) {
      return NextResponse.json(
        { error: 'Invalid categoryId' },
        { status: 400 }
      );
    }

    // Verify category exists
    const category = getCategoryById(categoryId);
    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Get category tool config
    const categoryConfig = getCategoryToolConfig(categoryId, 'task_planner');
    const config = (categoryConfig?.config || {}) as TaskPlannerConfig;
    const templates = config.templates || {};

    const template = templates[key];
    if (!template) {
      return NextResponse.json(
        { error: `Template "${key}" not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      categoryId,
      categoryName: category.name,
      template: { key, ...template },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Elevated access required') {
      return NextResponse.json({ error: 'Elevated access required' }, { status: 403 });
    }

    console.error('Failed to fetch template:', error);
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/tools/task-planner/templates/[key]
 * Update a template (Admin and Superuser can update)
 *
 * Body:
 * {
 *   categoryId: number,
 *   name?: string,
 *   description?: string,
 *   active?: boolean,      // Only Admin can set to false (deactivate)
 *   placeholders?: string[],
 *   tasks?: Array<{ id: number, description: string }>
 * }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireElevated();

    const { key } = await params;
    const body = await request.json();
    const { categoryId, name, description, active, placeholders, tasks } = body;

    if (!categoryId || typeof categoryId !== 'number') {
      return NextResponse.json(
        { error: 'categoryId is required' },
        { status: 400 }
      );
    }

    // Verify category exists
    const category = getCategoryById(categoryId);
    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Get existing config
    const categoryConfig = getCategoryToolConfig(categoryId, 'task_planner');
    const existingConfig = (categoryConfig?.config || {}) as TaskPlannerConfig;
    const existingTemplates = existingConfig.templates || {};

    const existingTemplate = existingTemplates[key];
    if (!existingTemplate) {
      return NextResponse.json(
        { error: `Template "${key}" not found` },
        { status: 404 }
      );
    }

    // Only admin can deactivate templates
    if (active === false && !user.isAdmin) {
      return NextResponse.json(
        { error: 'Only Admin can deactivate templates' },
        { status: 403 }
      );
    }

    // Validate tasks if provided
    if (tasks !== undefined) {
      if (!Array.isArray(tasks) || tasks.length === 0) {
        return NextResponse.json(
          { error: 'tasks must be a non-empty array' },
          { status: 400 }
        );
      }
      for (const task of tasks) {
        if (typeof task.id !== 'number' || typeof task.description !== 'string') {
          return NextResponse.json(
            { error: 'Each task must have an id (number) and description (string)' },
            { status: 400 }
          );
        }
      }
    }

    // Build updated template
    const updatedTemplate: TaskTemplate = {
      ...existingTemplate,
      name: name?.trim() ?? existingTemplate.name,
      description: description?.trim() ?? existingTemplate.description,
      active: active ?? existingTemplate.active,
      placeholders: placeholders !== undefined
        ? placeholders.filter((p: unknown): p is string => typeof p === 'string')
        : existingTemplate.placeholders,
      tasks: tasks !== undefined
        ? tasks.map((t: { id?: number; description: string }, idx: number) => ({
            id: t.id ?? idx + 1,
            description: t.description,
          }))
        : existingTemplate.tasks,
      updatedBy: user.email,
      updatedAt: new Date().toISOString(),
    };

    // Update config
    const updatedConfig: TaskPlannerConfig = {
      ...existingConfig,
      templates: {
        ...existingTemplates,
        [key]: updatedTemplate,
      },
    };

    // Save to database
    upsertCategoryToolConfig(
      categoryId,
      'task_planner',
      { config: updatedConfig as Record<string, unknown> },
      user.email
    );

    return NextResponse.json({
      success: true,
      template: { key, ...updatedTemplate },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Elevated access required') {
      return NextResponse.json({ error: 'Elevated access required' }, { status: 403 });
    }

    console.error('Failed to update template:', error);
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/tools/task-planner/templates/[key]
 * Delete a template (Admin only)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin();

    const { key } = await params;
    const { searchParams } = new URL(request.url);
    const categoryIdParam = searchParams.get('categoryId');

    if (!categoryIdParam) {
      return NextResponse.json(
        { error: 'categoryId is required' },
        { status: 400 }
      );
    }

    const categoryId = parseInt(categoryIdParam, 10);
    if (isNaN(categoryId)) {
      return NextResponse.json(
        { error: 'Invalid categoryId' },
        { status: 400 }
      );
    }

    // Verify category exists
    const category = getCategoryById(categoryId);
    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Get existing config
    const categoryConfig = getCategoryToolConfig(categoryId, 'task_planner');
    const existingConfig = (categoryConfig?.config || {}) as TaskPlannerConfig;
    const existingTemplates = existingConfig.templates || {};

    if (!existingTemplates[key]) {
      return NextResponse.json(
        { error: `Template "${key}" not found` },
        { status: 404 }
      );
    }

    // Remove template (destructure to exclude the key)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [key]: _, ...remainingTemplates } = existingTemplates;

    // Update config
    const updatedConfig: TaskPlannerConfig = {
      ...existingConfig,
      templates: remainingTemplates,
    };

    // Save to database
    upsertCategoryToolConfig(
      categoryId,
      'task_planner',
      { config: updatedConfig as Record<string, unknown> },
      admin.email
    );

    return NextResponse.json({
      success: true,
      message: `Template "${key}" deleted`,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.error('Failed to delete template:', error);
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}
