/**
 * Admin API - ChromaDB Cleanup
 *
 * POST /api/admin/chroma/cleanup - Delete orphaned ChromaDB collections
 *
 * Query params:
 *   dryRun=true - Preview what would be deleted without actually deleting
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getAllCategories } from '@/lib/db/categories';
import {
  listCategoryCollections,
  deleteCategoryCollection,
  collectionNames,
  getCollectionCount,
} from '@/lib/chroma';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dryRun') === 'true';

    // Get all category slugs from database
    const categories = getAllCategories();
    const validSlugs = new Set(categories.map((c) => c.slug));

    // Get all ChromaDB category collections
    const chromaCollections = await listCategoryCollections();

    // Find orphaned collections (exist in ChromaDB but not in database)
    const orphaned: { name: string; slug: string; vectorCount: number }[] = [];

    for (const slug of chromaCollections) {
      if (!validSlugs.has(slug)) {
        const collectionName = collectionNames.forCategory(slug);
        const vectorCount = await getCollectionCount(collectionName);
        orphaned.push({ name: collectionName, slug, vectorCount });
      }
    }

    if (orphaned.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No orphaned collections found',
        orphaned: [],
        deleted: [],
      });
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        message: `Found ${orphaned.length} orphaned collection(s)`,
        orphaned,
        deleted: [],
      });
    }

    // Delete orphaned collections
    const deleted: string[] = [];
    const errors: { collection: string; error: string }[] = [];

    for (const { slug, name } of orphaned) {
      try {
        await deleteCategoryCollection(slug);
        deleted.push(name);
      } catch (err) {
        errors.push({
          collection: name,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${deleted.length} orphaned collection(s)`,
      orphaned,
      deleted,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.error('Error cleaning up ChromaDB:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup ChromaDB collections' },
      { status: 500 }
    );
  }
}
