/**
 * Admin Task Planner Templates API
 *
 * GET  /api/admin/tools/task-planner/templates?categoryId=X - List templates for a category
 * POST /api/admin/tools/task-planner/templates - Create a new template
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

/**
 * GET /api/admin/tools/task-planner/templates
 * List all templates for a category
 */
export async function GET(request: NextRequest) {
  try {
    await requireElevated();

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

    // Get category tool config for task_planner
    const categoryConfig = getCategoryToolConfig(categoryId, 'task_planner');
    const config = (categoryConfig?.config || {}) as TaskPlannerConfig;
    const templates = config.templates || {};

    // Convert to array for easier frontend handling
    const templateList = Object.entries(templates).map(([key, template]) => ({
      key,
      ...template,
    }));

    return NextResponse.json({
      categoryId,
      categoryName: category.name,
      categorySlug: category.slug,
      templates: templateList,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Elevated access required') {
      return NextResponse.json({ error: 'Elevated access required' }, { status: 403 });
    }

    console.error('Failed to fetch templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/tools/task-planner/templates
 * Create a new template
 *
 * Body:
 * {
 *   categoryId: number,
 *   key: string,           // Template identifier (e.g., "country_assessment")
 *   name: string,          // Display name
 *   description: string,   // When to use this template
 *   placeholders: string[], // Variables (e.g., ["country"])
 *   tasks: Array<{ id: number, description: string }>
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();

    const body = await request.json();
    const { categoryId, key, name, description, placeholders, tasks } = body;

    // Validate required fields
    if (!categoryId || typeof categoryId !== 'number') {
      return NextResponse.json(
        { error: 'categoryId is required' },
        { status: 400 }
      );
    }

    if (!key || typeof key !== 'string' || !/^[a-z_][a-z0-9_]*$/.test(key)) {
      return NextResponse.json(
        { error: 'key must be a valid identifier (lowercase, underscores, no spaces)' },
        { status: 400 }
      );
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json(
        { error: 'tasks must be a non-empty array' },
        { status: 400 }
      );
    }

    // Validate tasks structure
    for (const task of tasks) {
      if (typeof task.id !== 'number' || typeof task.description !== 'string') {
        return NextResponse.json(
          { error: 'Each task must have an id (number) and description (string)' },
          { status: 400 }
        );
      }
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

    // Check if template key already exists
    if (existingTemplates[key]) {
      return NextResponse.json(
        { error: `Template with key "${key}" already exists` },
        { status: 409 }
      );
    }

    // Create new template
    const newTemplate: TaskTemplate = {
      name: name.trim(),
      description: description?.trim() || '',
      active: true,
      placeholders: Array.isArray(placeholders)
        ? placeholders.filter((p): p is string => typeof p === 'string')
        : [],
      tasks: tasks.map((t, idx) => ({
        id: t.id ?? idx + 1,
        description: t.description,
      })),
      createdBy: admin.email,
      updatedBy: admin.email,
      updatedAt: new Date().toISOString(),
    };

    // Update config with new template
    const updatedConfig: TaskPlannerConfig = {
      ...existingConfig,
      templates: {
        ...existingTemplates,
        [key]: newTemplate,
      },
    };

    // Save to database
    upsertCategoryToolConfig(
      categoryId,
      'task_planner',
      { config: updatedConfig as Record<string, unknown> },
      admin.email
    );

    return NextResponse.json(
      {
        success: true,
        template: { key, ...newTemplate },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.error('Failed to create template:', error);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
