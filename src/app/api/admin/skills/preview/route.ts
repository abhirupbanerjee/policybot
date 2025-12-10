/**
 * Admin Skills Preview API
 *
 * POST /api/admin/skills/preview - Preview which skills would activate for a given input
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireElevated } from '@/lib/auth';
import { previewSkillResolution } from '@/lib/skills/resolver';

export async function POST(request: NextRequest) {
  try {
    await requireElevated();

    const body = await request.json();
    const { category_ids, test_message } = body;

    if (!test_message || typeof test_message !== 'string') {
      return NextResponse.json(
        { error: 'Test message is required' },
        { status: 400 }
      );
    }

    const categoryIds = Array.isArray(category_ids)
      ? category_ids.filter((id): id is number => typeof id === 'number')
      : [];

    const preview = previewSkillResolution(categoryIds, test_message);

    return NextResponse.json({ preview });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Elevated access required') {
      return NextResponse.json({ error: 'Elevated access required' }, { status: 403 });
    }

    console.error('Error previewing skills:', error);
    return NextResponse.json(
      { error: 'Failed to preview skills' },
      { status: 500 }
    );
  }
}
