/**
 * Admin Categories API
 *
 * GET  /api/admin/categories - List all categories with stats
 * POST /api/admin/categories - Create a new category
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import {
  getAllCategoriesWithStats,
  createCategory,
  getCategoryByName,
} from '@/lib/db/categories';

export async function GET() {
  try {
    await requireAdmin();

    const categories = getAllCategoriesWithStats();

    return NextResponse.json({ categories });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();

    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      );
    }

    // Check for duplicate
    const existing = getCategoryByName(name.trim());
    if (existing) {
      return NextResponse.json(
        { error: `Category "${name}" already exists` },
        { status: 409 }
      );
    }

    const category = createCategory({
      name: name.trim(),
      description: description?.trim() || undefined,
      createdBy: admin.email,
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.error('Error creating category:', error);
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    );
  }
}
