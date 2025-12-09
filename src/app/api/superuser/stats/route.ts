/**
 * Super User Stats API
 *
 * GET /api/superuser/stats
 * Returns statistics for super user's assigned categories:
 * - Document counts and status
 * - User/subscriber counts
 * - Recent activity in their categories
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getUserRole, getUserId } from '@/lib/users';
import { getSuperUserWithAssignments, getUsersSubscribedToCategory } from '@/lib/db/users';
import { queryAll } from '@/lib/db';
import { getCategoryPrompt } from '@/lib/db/category-prompts';

interface CategoryStats {
  categoryId: number;
  categoryName: string;
  categorySlug: string;
  documentCount: number;
  readyDocuments: number;
  processingDocuments: number;
  errorDocuments: number;
  totalChunks: number;
  subscriberCount: number;
  activeSubscribers: number;
  hasCustomPrompt: boolean;
}

interface SuperUserStats {
  timestamp: string;
  assignedCategories: number;
  totalDocuments: number;
  totalSubscribers: number;
  categories: CategoryStats[];
  recentDocuments: {
    id: number;
    filename: string;
    categoryName: string;
    status: string;
    uploadedBy: string;
    uploadedAt: string;
  }[];
  recentSubscriptions: {
    userEmail: string;
    categoryName: string;
    subscribedAt: string;
    isActive: boolean;
  }[];
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = await getUserRole(user.email);
    if (role !== 'superuser') {
      return NextResponse.json({ error: 'Super user access required' }, { status: 403 });
    }

    const userId = await getUserId(user.email);
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get super user's assigned categories
    const superUserData = getSuperUserWithAssignments(userId);
    if (!superUserData || superUserData.assignedCategories.length === 0) {
      return NextResponse.json({
        timestamp: new Date().toISOString(),
        assignedCategories: 0,
        totalDocuments: 0,
        totalSubscribers: 0,
        categories: [],
        recentDocuments: [],
        recentSubscriptions: [],
      } as SuperUserStats);
    }

    const categoryIds = superUserData.assignedCategories.map(c => c.categoryId);
    const placeholders = categoryIds.map(() => '?').join(', ');

    // Get document stats per category
    const categoryDocStats = queryAll<{
      category_id: number;
      documentCount: number;
      readyCount: number;
      processingCount: number;
      errorCount: number;
      totalChunks: number;
    }>(`
      SELECT
        dc.category_id,
        COUNT(DISTINCT dc.document_id) as documentCount,
        SUM(CASE WHEN d.status = 'ready' THEN 1 ELSE 0 END) as readyCount,
        SUM(CASE WHEN d.status = 'processing' THEN 1 ELSE 0 END) as processingCount,
        SUM(CASE WHEN d.status = 'error' THEN 1 ELSE 0 END) as errorCount,
        SUM(d.chunk_count) as totalChunks
      FROM document_categories dc
      JOIN documents d ON dc.document_id = d.id
      WHERE dc.category_id IN (${placeholders})
      GROUP BY dc.category_id
    `, categoryIds);

    // Build category stats
    const categories: CategoryStats[] = [];
    let totalDocuments = 0;
    let totalSubscribers = 0;

    for (const cat of superUserData.assignedCategories) {
      const docStats = categoryDocStats.find(s => s.category_id === cat.categoryId);
      const subscribers = getUsersSubscribedToCategory(cat.categoryId);
      const activeSubscribers = subscribers.filter(s => s.isActive).length;
      const hasCustomPrompt = !!getCategoryPrompt(cat.categoryId);

      const catStats: CategoryStats = {
        categoryId: cat.categoryId,
        categoryName: cat.categoryName,
        categorySlug: cat.categorySlug,
        documentCount: docStats?.documentCount || 0,
        readyDocuments: docStats?.readyCount || 0,
        processingDocuments: docStats?.processingCount || 0,
        errorDocuments: docStats?.errorCount || 0,
        totalChunks: docStats?.totalChunks || 0,
        subscriberCount: subscribers.length,
        activeSubscribers,
        hasCustomPrompt,
      };

      categories.push(catStats);
      totalDocuments += catStats.documentCount;
      totalSubscribers += activeSubscribers;
    }

    // Get recent documents in super user's categories
    const recentDocuments = queryAll<{
      id: number;
      filename: string;
      categoryName: string;
      status: string;
      uploadedBy: string;
      uploadedAt: string;
    }>(`
      SELECT
        d.id,
        d.filename,
        c.name as categoryName,
        d.status,
        d.uploaded_by as uploadedBy,
        d.created_at as uploadedAt
      FROM documents d
      JOIN document_categories dc ON d.id = dc.document_id
      JOIN categories c ON dc.category_id = c.id
      WHERE dc.category_id IN (${placeholders})
      ORDER BY d.created_at DESC
      LIMIT 10
    `, categoryIds);

    // Get recent subscriptions in super user's categories
    const recentSubscriptions = queryAll<{
      userEmail: string;
      categoryName: string;
      subscribedAt: string;
      isActive: number;
    }>(`
      SELECT
        u.email as userEmail,
        c.name as categoryName,
        us.subscribed_at as subscribedAt,
        us.is_active as isActive
      FROM user_subscriptions us
      JOIN users u ON us.user_id = u.id
      JOIN categories c ON us.category_id = c.id
      WHERE us.category_id IN (${placeholders})
      ORDER BY us.subscribed_at DESC
      LIMIT 10
    `, categoryIds);

    const stats: SuperUserStats = {
      timestamp: new Date().toISOString(),
      assignedCategories: superUserData.assignedCategories.length,
      totalDocuments,
      totalSubscribers,
      categories,
      recentDocuments,
      recentSubscriptions: recentSubscriptions.map(s => ({
        ...s,
        isActive: Boolean(s.isActive),
      })),
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching super user stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
