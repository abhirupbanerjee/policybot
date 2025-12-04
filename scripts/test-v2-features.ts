/**
 * Policy Bot v2.0 Feature Test Script
 *
 * Tests all major features from the v2.0 plan:
 * 1. Database Layer (SQLite)
 * 2. User Management (Admin, Super User, User roles)
 * 3. Category System (CRUD, subscriptions, assignments)
 * 4. Document Management (with categories, global docs)
 * 5. Thread Management (with categories)
 * 6. Message Storage
 * 7. Configuration System
 * 8. ChromaDB Multi-Collection Support
 * 9. Storage Monitoring
 *
 * Run with: npx tsx scripts/test-v2-features.ts
 */

import { getDatabase } from '../src/lib/db';
import {
  createUser,
  getUserByEmail,
  getAllUsers,
  deleteUserByEmail,
  updateUser,
  addSubscription,
  removeSubscription,
  getActiveSubscriptions,
  assignCategoryToSuperUser,
  removeCategoryFromSuperUser,
  getSuperUserCategories,
  type UserRole,
} from '../src/lib/db/users';
import {
  createCategory,
  getCategoryById,
  getCategoryBySlug,
  getAllCategories,
  getAllCategoriesWithStats,
  updateCategory,
  deleteCategory,
  getCategoriesForUser,
  getCategoriesForSuperUser,
} from '../src/lib/db/categories';
import {
  createDocument,
  getDocumentById,
  getDocumentWithCategories,
  getAllDocumentsWithCategories,
  updateDocument,
  deleteDocument,
  setDocumentCategories,
  setDocumentGlobal,
} from '../src/lib/db/documents';
import {
  createThread,
  getThreadById,
  getThreadWithDetails,
  getThreadsForUser,
  updateThreadTitle,
  deleteThread,
  addMessage,
  getMessagesForThread,
  setThreadCategories,
  getThreadCategories,
  getThreadCategorySlugs,
  addThreadUpload,
  getThreadUploads,
  deleteThreadUpload,
} from '../src/lib/db/threads';
import {
  getRagSettings,
  setRagSettings,
  getLlmSettings,
  setLlmSettings,
  getSystemPrompt,
  setSystemPrompt,
  getUploadLimits,
  setUploadLimits,
  getAcronymMappings,
  setAcronymMappings,
  getTavilySettings,
  setTavilySettings,
} from '../src/lib/db/config';
import {
  getDatabaseStats,
  getChromaStats,
  getFileStorageStats,
  getSystemStats,
  getRecentActivity,
} from '../src/lib/monitoring';

// Test tracking
let passed = 0;
let failed = 0;
const results: { name: string; status: 'pass' | 'fail'; error?: string }[] = [];

function test(name: string, fn: () => boolean | void): void {
  try {
    const result = fn();
    if (result === false) {
      results.push({ name, status: 'fail' });
      console.log(`❌ ${name}`);
      failed++;
    } else {
      results.push({ name, status: 'pass' });
      console.log(`✅ ${name}`);
      passed++;
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({ name, status: 'fail', error: errorMsg });
    console.log(`❌ ${name}`);
    console.log(`   Error: ${errorMsg}`);
    failed++;
  }
}

async function testAsync(name: string, fn: () => Promise<boolean | void>): Promise<void> {
  try {
    const result = await fn();
    if (result === false) {
      results.push({ name, status: 'fail' });
      console.log(`❌ ${name}`);
      failed++;
    } else {
      results.push({ name, status: 'pass' });
      console.log(`✅ ${name}`);
      passed++;
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({ name, status: 'fail', error: errorMsg });
    console.log(`❌ ${name}`);
    console.log(`   Error: ${errorMsg}`);
    failed++;
  }
}

// Test data
const testData = {
  adminEmail: `admin-${Date.now()}@test.com`,
  superUserEmail: `superuser-${Date.now()}@test.com`,
  userEmail: `user-${Date.now()}@test.com`,
  categoryName: `Test Category ${Date.now()}`,
  categoryName2: `Second Category ${Date.now()}`,
  documentFilename: `test-doc-${Date.now()}.pdf`,
  threadTitle: `Test Thread ${Date.now()}`,
};

// Store IDs for cleanup
let adminId: number;
let superUserId: number;
let userId: number;
let categoryId: number;
let categoryId2: number;
let documentId: number;
let threadId: string;

async function runTests() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║           Policy Bot v2.0 Feature Tests                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Initialize database
  console.log('Initializing database...');
  getDatabase();
  console.log('Database initialized.\n');

  // ========================================
  // 1. USER MANAGEMENT TESTS
  // ========================================
  console.log('━━━ 1. User Management ━━━');

  test('Create admin user', () => {
    const user = createUser({
      email: testData.adminEmail,
      name: 'Test Admin',
      role: 'admin' as UserRole,
      addedBy: 'test-script',
    });
    adminId = user.id;
    return user.role === 'admin';
  });

  test('Create super user', () => {
    const user = createUser({
      email: testData.superUserEmail,
      name: 'Test Super User',
      role: 'superuser' as UserRole,
      addedBy: 'test-script',
    });
    superUserId = user.id;
    return user.role === 'superuser';
  });

  test('Create regular user', () => {
    const user = createUser({
      email: testData.userEmail,
      name: 'Test User',
      role: 'user' as UserRole,
      addedBy: 'test-script',
    });
    userId = user.id;
    return user.role === 'user';
  });

  test('Get user by email', () => {
    const user = getUserByEmail(testData.adminEmail);
    return user?.email === testData.adminEmail;
  });

  test('Get all users includes test users', () => {
    const users = getAllUsers();
    return users.some(u => u.email === testData.adminEmail) &&
           users.some(u => u.email === testData.superUserEmail) &&
           users.some(u => u.email === testData.userEmail);
  });

  test('Update user role', () => {
    // Temporarily change role then change back
    const updated = updateUser(userId, { role: 'superuser' });
    const reverted = updateUser(userId, { role: 'user' });
    return updated?.role === 'superuser' && reverted?.role === 'user';
  });

  // ========================================
  // 2. CATEGORY MANAGEMENT TESTS
  // ========================================
  console.log('\n━━━ 2. Category Management ━━━');

  test('Create category', () => {
    const category = createCategory({
      name: testData.categoryName,
      description: 'Test category description',
      createdBy: 'test-script',
    });
    categoryId = category.id;
    return category.name === testData.categoryName && category.slug.length > 0;
  });

  test('Create second category', () => {
    const category = createCategory({
      name: testData.categoryName2,
      description: 'Second test category',
      createdBy: 'test-script',
    });
    categoryId2 = category.id;
    return category.id !== categoryId;
  });

  test('Get category by ID', () => {
    const category = getCategoryById(categoryId);
    return category?.name === testData.categoryName;
  });

  test('Get category by slug', () => {
    const category = getCategoryById(categoryId);
    const bySlug = getCategoryBySlug(category!.slug);
    return bySlug?.id === categoryId;
  });

  test('Update category', () => {
    const updated = updateCategory(categoryId, {
      name: testData.categoryName + ' Updated',
      description: 'Updated description',
    });
    return updated?.description === 'Updated description';
  });

  test('Get all categories', () => {
    const categories = getAllCategories();
    return categories.some(c => c.id === categoryId);
  });

  test('Get categories with stats', () => {
    const cats = getAllCategoriesWithStats();
    const cat = cats.find(c => c.id === categoryId);
    return cat !== undefined && 'documentCount' in cat;
  });

  // ========================================
  // 3. USER SUBSCRIPTIONS TESTS
  // ========================================
  console.log('\n━━━ 3. User Subscriptions ━━━');

  test('Add subscription', () => {
    return addSubscription(userId, categoryId, 'test-script') === true;
  });

  test('Get active subscriptions', () => {
    const subs = getActiveSubscriptions(userId);
    return subs.includes(categoryId);
  });

  test('Get categories for user', () => {
    const cats = getCategoriesForUser(userId);
    return cats.some(c => c.id === categoryId);
  });

  test('Remove subscription', () => {
    const removed = removeSubscription(userId, categoryId);
    const subs = getActiveSubscriptions(userId);
    const reAdded = addSubscription(userId, categoryId, 'test-script');
    return removed && !subs.includes(categoryId) && reAdded;
  });

  // ========================================
  // 4. SUPER USER CATEGORY ASSIGNMENT TESTS
  // ========================================
  console.log('\n━━━ 4. Super User Category Assignments ━━━');

  test('Assign super user to category', () => {
    return assignCategoryToSuperUser(superUserId, categoryId, 'test-script') === true;
  });

  test('Get super user categories', () => {
    const catIds = getSuperUserCategories(superUserId);
    return catIds.includes(categoryId);
  });

  test('Get categories for super user', () => {
    const cats = getCategoriesForSuperUser(superUserId);
    return cats.some(c => c.id === categoryId);
  });

  test('Remove super user from category', () => {
    const removed = removeCategoryFromSuperUser(superUserId, categoryId);
    const catIds = getSuperUserCategories(superUserId);
    const reAssigned = assignCategoryToSuperUser(superUserId, categoryId, 'test-script');
    return removed && !catIds.includes(categoryId) && reAssigned;
  });

  // ========================================
  // 5. DOCUMENT MANAGEMENT TESTS
  // ========================================
  console.log('\n━━━ 5. Document Management ━━━');

  test('Create document with category', () => {
    const doc = createDocument({
      filename: testData.documentFilename,
      filepath: testData.documentFilename,
      fileSize: 1024,
      uploadedBy: 'test-script',
      isGlobal: false,
      categoryIds: [categoryId],
    });
    documentId = doc.id;
    return doc.filename === testData.documentFilename;
  });

  test('Get document by ID', () => {
    const doc = getDocumentById(documentId);
    return doc?.filename === testData.documentFilename;
  });

  test('Get document with categories', () => {
    const doc = getDocumentWithCategories(documentId);
    return doc !== null && doc !== undefined && doc.categories.length === 1 && doc.categories[0].id === categoryId;
  });

  test('Update document status', () => {
    const updated = updateDocument(documentId, { status: 'ready', chunkCount: 10 });
    return updated?.status === 'ready' && updated?.chunk_count === 10;
  });

  test('Set document categories', () => {
    setDocumentCategories(documentId, [categoryId, categoryId2]);
    const doc = getDocumentWithCategories(documentId);
    return doc!.categories.length === 2;
  });

  test('Set document global', () => {
    setDocumentGlobal(documentId, true);
    const doc = getDocumentWithCategories(documentId);
    const isGlobal = doc!.isGlobal;
    setDocumentGlobal(documentId, false); // Reset
    return isGlobal === true;
  });

  test('Get all documents with categories', () => {
    const docs = getAllDocumentsWithCategories();
    return docs.some(d => d.id === documentId);
  });

  // ========================================
  // 6. THREAD MANAGEMENT TESTS
  // ========================================
  console.log('\n━━━ 6. Thread Management ━━━');

  test('Create thread with category', () => {
    const thread = createThread(userId, testData.threadTitle, [categoryId]);
    threadId = thread.id;
    return thread.title === testData.threadTitle;
  });

  test('Get thread by ID', () => {
    const thread = getThreadById(threadId);
    return thread?.title === testData.threadTitle;
  });

  test('Get thread with details', () => {
    const thread = getThreadWithDetails(threadId);
    return thread !== null && thread !== undefined && thread.categories.length === 1;
  });

  test('Get threads for user', () => {
    const threads = getThreadsForUser(userId);
    return threads.some(t => t.id === threadId);
  });

  test('Update thread title', () => {
    const success = updateThreadTitle(threadId, 'Updated Title');
    const thread = getThreadById(threadId);
    updateThreadTitle(threadId, testData.threadTitle); // Reset
    return success && thread?.title === 'Updated Title';
  });

  test('Set thread categories', () => {
    setThreadCategories(threadId, [categoryId, categoryId2]);
    const cats = getThreadCategories(threadId);
    setThreadCategories(threadId, [categoryId]); // Reset
    return cats.length === 2;
  });

  test('Get thread category slugs', () => {
    const slugs = getThreadCategorySlugs(threadId);
    return slugs.length > 0;
  });

  // ========================================
  // 7. MESSAGE TESTS
  // ========================================
  console.log('\n━━━ 7. Message Storage ━━━');

  test('Add user message', () => {
    const msg = addMessage(threadId, 'user', 'Test user message');
    return msg.role === 'user' && msg.content === 'Test user message';
  });

  test('Add assistant message with sources', () => {
    const msg = addMessage(threadId, 'assistant', 'Test assistant response', {
      sources: [{ documentName: 'test.pdf', pageNumber: 1, chunkText: 'test', score: 0.95 }],
    });
    return msg.role === 'assistant' && msg.sources?.length === 1;
  });

  test('Add tool message', () => {
    const msg = addMessage(threadId, 'tool', 'Tool result', {
      toolCallId: 'call_123',
      toolName: 'web_search',
    });
    return msg.role === 'tool' && msg.toolCallId === 'call_123';
  });

  test('Get messages for thread', () => {
    const messages = getMessagesForThread(threadId);
    return messages.length === 3;
  });

  // ========================================
  // 8. THREAD UPLOADS TESTS
  // ========================================
  console.log('\n━━━ 8. Thread Uploads ━━━');

  let uploadId: number;

  test('Add thread upload', () => {
    const upload = addThreadUpload(threadId, 'upload.pdf', '/path/to/upload.pdf', 2048);
    uploadId = upload.id;
    return upload.filename === 'upload.pdf';
  });

  test('Get thread uploads', () => {
    const uploads = getThreadUploads(threadId);
    return uploads.some(u => u.id === uploadId);
  });

  test('Delete thread upload', () => {
    const success = deleteThreadUpload(uploadId);
    const uploads = getThreadUploads(threadId);
    return success && !uploads.some(u => u.id === uploadId);
  });

  // ========================================
  // 9. CONFIGURATION TESTS
  // ========================================
  console.log('\n━━━ 9. Configuration System ━━━');

  test('Get RAG settings (defaults)', () => {
    const settings = getRagSettings();
    return settings.topKChunks > 0 && settings.chunkSize > 0;
  });

  test('Set and get RAG settings', () => {
    const original = getRagSettings();
    setRagSettings({ ...original, topKChunks: 25 }, 'test-script');
    const updated = getRagSettings();
    setRagSettings(original, 'test-script'); // Reset
    return updated.topKChunks === 25;
  });

  test('Get LLM settings', () => {
    const settings = getLlmSettings();
    return settings.model.length > 0;
  });

  test('Set and get LLM settings', () => {
    const original = getLlmSettings();
    setLlmSettings({ ...original, temperature: 0.5 }, 'test-script');
    const updated = getLlmSettings();
    setLlmSettings(original, 'test-script'); // Reset
    return updated.temperature === 0.5;
  });

  test('Get system prompt', () => {
    const prompt = getSystemPrompt();
    return prompt.length > 0;
  });

  test('Set and get system prompt', () => {
    const original = getSystemPrompt();
    setSystemPrompt('Test prompt', 'test-script');
    const updated = getSystemPrompt();
    setSystemPrompt(original, 'test-script'); // Reset
    return updated === 'Test prompt';
  });

  test('Get upload limits', () => {
    const limits = getUploadLimits();
    return limits.maxFilesPerThread > 0 && limits.maxFileSizeMB > 0;
  });

  test('Get acronym mappings', () => {
    const mappings = getAcronymMappings();
    return typeof mappings === 'object';
  });

  test('Set acronym mappings', () => {
    const original = getAcronymMappings();
    setAcronymMappings({ test: ['testing', 'test value'] }, 'test-script');
    const updated = getAcronymMappings();
    setAcronymMappings(original, 'test-script'); // Reset
    return updated.test?.[0] === 'testing';
  });

  test('Get Tavily settings', () => {
    const settings = getTavilySettings();
    return 'enabled' in settings && 'maxResults' in settings;
  });

  // ========================================
  // 10. MONITORING TESTS
  // ========================================
  console.log('\n━━━ 10. Storage Monitoring ━━━');

  test('Get database stats', () => {
    const stats = getDatabaseStats();
    return stats.users.total >= 3 && stats.categories.total >= 2;
  });

  await testAsync('Get ChromaDB stats', async () => {
    const stats = await getChromaStats();
    return 'connected' in stats && 'totalVectors' in stats;
  });

  await testAsync('Get file storage stats', async () => {
    const stats = await getFileStorageStats();
    return 'globalDocsDir' in stats && 'threadsDir' in stats && 'dataDir' in stats;
  });

  await testAsync('Get system stats', async () => {
    const stats = await getSystemStats();
    return 'database' in stats && 'chroma' in stats && 'storage' in stats;
  });

  test('Get recent activity', () => {
    const activity = getRecentActivity(10);
    return 'recentThreads' in activity && 'recentDocuments' in activity;
  });

  // ========================================
  // CLEANUP
  // ========================================
  console.log('\n━━━ Cleanup ━━━');

  test('Delete thread (cascades to messages)', () => {
    const result = deleteThread(threadId);
    return result.messageCount === 3;
  });

  test('Delete document', () => {
    return deleteDocument(documentId) === true;
  });

  test('Delete second category', () => {
    return deleteCategory(categoryId2) === true;
  });

  test('Delete first category', () => {
    return deleteCategory(categoryId) === true;
  });

  test('Delete regular user', () => {
    return deleteUserByEmail(testData.userEmail) === true;
  });

  test('Delete super user', () => {
    return deleteUserByEmail(testData.superUserEmail) === true;
  });

  test('Delete admin user', () => {
    return deleteUserByEmail(testData.adminEmail) === true;
  });

  // ========================================
  // SUMMARY
  // ========================================
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                      Test Summary                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  📊 Total:  ${passed + failed}`);
  console.log(`  📈 Rate:   ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    console.log('Failed tests:');
    results.filter(r => r.status === 'fail').forEach(r => {
      console.log(`  - ${r.name}${r.error ? `: ${r.error}` : ''}`);
    });
    console.log('');
    process.exit(1);
  } else {
    console.log('🎉 All tests passed! Policy Bot v2.0 features verified.\n');
    process.exit(0);
  }
}

runTests().catch(console.error);
