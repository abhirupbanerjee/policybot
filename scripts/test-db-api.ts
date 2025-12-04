/**
 * Test script to verify DB-API alignment and backward compatibility
 * Run with: npx tsx scripts/test-db-api.ts
 */

import { getDatabase } from '../src/lib/db';
import {
  createUser,
  getUserByEmail,
  getAllUsers,
  deleteUserByEmail,
  addSubscription,
  removeSubscription,
  getActiveSubscriptions,
  type UserRole,
} from '../src/lib/db/users';
import {
  createCategory,
  getCategoryById,
  getAllCategories,
  deleteCategory,
  getCategoriesForUser,
} from '../src/lib/db/categories';
import {
  createDocument,
  getDocumentById,
  getDocumentWithCategories,
  updateDocument,
  deleteDocument,
  setDocumentCategories,
} from '../src/lib/db/documents';
import {
  createThread,
  getThreadById,
  getThreadWithDetails,
  addMessage,
  getMessagesForThread,
  setThreadCategories,
  getThreadCategorySlugs,
  deleteThread,
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
} from '../src/lib/db/config';

// Test results tracking
let passed = 0;
let failed = 0;

function test(name: string, fn: () => boolean | void): void {
  try {
    const result = fn();
    if (result === false) {
      console.log(`❌ FAIL: ${name}`);
      failed++;
    } else {
      console.log(`✅ PASS: ${name}`);
      passed++;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Error: ${error instanceof Error ? error.message : error}`);
    failed++;
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string): boolean {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.log(`   Expected: ${JSON.stringify(expected)}`);
    console.log(`   Actual: ${JSON.stringify(actual)}`);
    if (message) console.log(`   ${message}`);
    return false;
  }
  return true;
}

function assertTruthy<T>(value: T, message?: string): boolean {
  if (!value) {
    console.log(`   Expected truthy value, got: ${value}`);
    if (message) console.log(`   ${message}`);
    return false;
  }
  return true;
}

async function runTests() {
  console.log('\n=== Policy Bot v2.0 DB-API Alignment Tests ===\n');

  // Initialize database
  console.log('Initializing database...');
  getDatabase();
  console.log('Database initialized.\n');

  // ============ User Tests ============
  console.log('--- User Tests ---');

  const testEmail = `test-${Date.now()}@example.com`;

  test('Create user', () => {
    const user = createUser({
      email: testEmail,
      name: 'Test User',
      role: 'user' as UserRole,
      addedBy: 'test-script',
    });
    return assertTruthy(user) && assertEqual(user.email, testEmail);
  });

  test('Get user by email', () => {
    const user = getUserByEmail(testEmail);
    return assertTruthy(user) && assertEqual(user?.email, testEmail);
  });

  test('Get all users includes test user', () => {
    const users = getAllUsers();
    return users.some(u => u.email === testEmail);
  });

  // ============ Category Tests ============
  console.log('\n--- Category Tests ---');

  const testCategoryName = `Test Category ${Date.now()}`;
  const expectedSlug = testCategoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  let testCategoryId: number;

  test('Create category', () => {
    const category = createCategory({
      name: testCategoryName,
      description: 'Test description',
      createdBy: 'test-script',
    });
    testCategoryId = category.id;
    return assertTruthy(category) && assertEqual(category.name, testCategoryName);
  });

  test('Get category by ID', () => {
    const category = getCategoryById(testCategoryId);
    return assertTruthy(category) && assertEqual(category?.name, testCategoryName);
  });

  test('Get all categories includes test category', () => {
    const categories = getAllCategories();
    return categories.some(c => c.name === testCategoryName);
  });

  // ============ User Subscriptions Tests ============
  console.log('\n--- User Subscription Tests ---');

  const user = getUserByEmail(testEmail);
  const userId = user!.id;

  test('Add subscription to category', () => {
    const result = addSubscription(userId, testCategoryId, 'test-script');
    return result === true;
  });

  test('Get active subscriptions includes category', () => {
    const subs = getActiveSubscriptions(userId);
    return subs.includes(testCategoryId);
  });

  test('Get categories for user includes subscribed category', () => {
    const cats = getCategoriesForUser(userId);
    return cats.some(c => c.id === testCategoryId);
  });

  test('Remove subscription', () => {
    const result = removeSubscription(userId, testCategoryId);
    return result === true;
  });

  test('User subscriptions empty after removal', () => {
    const subs = getActiveSubscriptions(userId);
    return !subs.includes(testCategoryId);
  });

  // ============ Document Tests ============
  console.log('\n--- Document Tests ---');

  let testDocId: number;

  test('Create document with category', () => {
    const doc = createDocument({
      filename: 'test-doc.pdf',
      filepath: 'test-doc.pdf',
      fileSize: 1024,
      uploadedBy: 'test-script',
      isGlobal: false,
      categoryIds: [testCategoryId],
    });
    testDocId = doc.id;
    return assertTruthy(doc) && assertEqual(doc.filename, 'test-doc.pdf');
  });

  test('Get document with categories', () => {
    const doc = getDocumentWithCategories(testDocId);
    return assertTruthy(doc) && doc!.categories.length === 1;
  });

  test('Update document status', () => {
    const updated = updateDocument(testDocId, { status: 'ready', chunkCount: 10 });
    return assertTruthy(updated) && assertEqual(updated?.status, 'ready');
  });

  test('Set document categories', () => {
    setDocumentCategories(testDocId, [testCategoryId]);
    const doc = getDocumentWithCategories(testDocId);
    return doc!.categories.length === 1;
  });

  // ============ Thread Tests ============
  console.log('\n--- Thread Tests ---');

  let testThreadId: string;

  test('Create thread with category', () => {
    const thread = createThread(userId, 'Test Thread', [testCategoryId]);
    testThreadId = thread.id;
    return assertTruthy(thread) && assertEqual(thread.title, 'Test Thread');
  });

  test('Get thread by ID', () => {
    const thread = getThreadById(testThreadId);
    return assertTruthy(thread) && assertEqual(thread?.title, 'Test Thread');
  });

  test('Get thread with details includes category', () => {
    const thread = getThreadWithDetails(testThreadId);
    return assertTruthy(thread) && thread!.categories.length === 1;
  });

  test('Get thread category slugs', () => {
    const slugs = getThreadCategorySlugs(testThreadId);
    return slugs.includes(expectedSlug);
  });

  // ============ Message Tests ============
  console.log('\n--- Message Tests ---');

  test('Add user message to thread', () => {
    const msg = addMessage(testThreadId, 'user', 'Hello, this is a test message');
    return assertTruthy(msg) && assertEqual(msg.role, 'user');
  });

  test('Add assistant message with sources', () => {
    const msg = addMessage(testThreadId, 'assistant', 'This is a response', {
      sources: [{ documentName: 'test.pdf', pageNumber: 1, chunkText: 'test', score: 0.9 }],
    });
    return assertTruthy(msg) && msg.sources?.length === 1;
  });

  test('Get messages for thread', () => {
    const messages = getMessagesForThread(testThreadId);
    return messages.length === 2;
  });

  // ============ Config Tests ============
  console.log('\n--- Config Tests ---');

  test('Get RAG settings (defaults)', () => {
    const settings = getRagSettings();
    return assertTruthy(settings.topKChunks) && assertTruthy(settings.chunkSize);
  });

  test('Set and get RAG settings', () => {
    const newSettings = {
      topKChunks: 20,
      maxContextChunks: 15,
      similarityThreshold: 0.7,
      chunkSize: 600,
      chunkOverlap: 100,
      queryExpansionEnabled: true,
      cacheEnabled: true,
      cacheTTLSeconds: 7200,
    };
    setRagSettings(newSettings, 'test-script');
    const retrieved = getRagSettings();
    return assertEqual(retrieved.topKChunks, 20);
  });

  test('Get LLM settings (defaults)', () => {
    const settings = getLlmSettings();
    return assertTruthy(settings.model);
  });

  test('Set and get system prompt', () => {
    const testPrompt = 'You are a helpful test assistant.';
    setSystemPrompt(testPrompt, 'test-script');
    const retrieved = getSystemPrompt();
    return assertEqual(retrieved, testPrompt);
  });

  test('Get upload limits (defaults)', () => {
    const limits = getUploadLimits();
    return assertTruthy(limits.maxFilesPerThread) && assertTruthy(limits.maxFileSizeMB);
  });

  // ============ Backward Compatibility Tests ============
  console.log('\n--- Backward Compatibility Tests ---');

  test('Thread has expected API fields', () => {
    const thread = getThreadWithDetails(testThreadId);
    return (
      'id' in thread! &&
      'title' in thread &&
      'categories' in thread &&
      'messageCount' in thread &&
      'uploadCount' in thread
    );
  });

  test('Message has expected API fields', () => {
    const messages = getMessagesForThread(testThreadId);
    const msg = messages[0];
    return (
      'id' in msg &&
      'role' in msg &&
      'content' in msg &&
      'createdAt' in msg
    );
  });

  test('Document has expected API fields', () => {
    const doc = getDocumentWithCategories(testDocId);
    return (
      'id' in doc! &&
      'filename' in doc &&
      'filepath' in doc &&
      'file_size' in doc &&
      'status' in doc &&
      'isGlobal' in doc &&
      'categories' in doc
    );
  });

  test('Category has expected API fields', () => {
    const cat = getCategoryById(testCategoryId);
    return (
      'id' in cat! &&
      'name' in cat &&
      'slug' in cat &&
      'description' in cat
    );
  });

  // ============ Cleanup ============
  console.log('\n--- Cleanup ---');

  test('Delete thread (cascades to messages)', () => {
    const result = deleteThread(testThreadId);
    return result.messageCount === 2;
  });

  test('Delete document', () => {
    const result = deleteDocument(testDocId);
    return result === true;
  });

  test('Delete category', () => {
    const result = deleteCategory(testCategoryId);
    return result === true;
  });

  test('Delete user', () => {
    const result = deleteUserByEmail(testEmail);
    return result === true;
  });

  // ============ Summary ============
  console.log('\n=== Test Summary ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);

  if (failed > 0) {
    console.log('\n⚠️  Some tests failed. Please review the errors above.');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed! DB-API alignment verified.');
    process.exit(0);
  }
}

runTests().catch(console.error);
