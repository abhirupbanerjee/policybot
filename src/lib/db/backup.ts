/**
 * Database Backup/Restore Operations
 *
 * Export and import functions for backup feature
 */

import { execute, queryAll, transaction, getDatabase } from './index';
import type { DbDocument } from './documents';
import type { DbCategory } from './categories';
import type { DbUser } from './users';
import * as fs from 'fs';
import * as path from 'path';

// ============ Types ============

export interface DocumentCategoryRecord {
  document_id: number;
  category_id: number | null;
}

export interface UserSubscriptionRecord {
  user_id: number;
  category_id: number;
  is_active: number;
  subscribed_at: string;
  subscribed_by: string;
}

export interface SuperUserCategoryRecord {
  user_id: number;
  category_id: number;
  assigned_at: string;
  assigned_by: string;
}

export interface ThreadRecord {
  id: string;
  user_id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface MessageRecord {
  id: string;
  thread_id: string;
  role: string;
  content: string;
  sources_json: string | null;
  attachments_json: string | null;
  tool_calls_json: string | null;
  tool_call_id: string | null;
  tool_name: string | null;
  created_at: string;
}

export interface ThreadCategoryRecord {
  thread_id: string;
  category_id: number;
}

export interface ThreadUploadRecord {
  id: number;
  thread_id: string;
  filename: string;
  filepath: string;
  file_size: number;
  uploaded_at: string;
}

export interface ThreadOutputRecord {
  id: number;
  thread_id: string;
  message_id: string | null;
  filename: string;
  filepath: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

export interface SettingRecord {
  key: string;
  value: string;
  updated_at: string;
  updated_by: string | null;
}

// ============ Export Functions ============

/**
 * Export all documents
 */
export function exportDocuments(): DbDocument[] {
  return queryAll<DbDocument>(`
    SELECT id, filename, filepath, file_size, is_global, chunk_count, status, error_message, uploaded_by, created_at
    FROM documents
    ORDER BY id
  `);
}

/**
 * Export all categories
 */
export function exportCategories(): DbCategory[] {
  return queryAll<DbCategory>(`
    SELECT id, name, slug, description, created_by, created_at
    FROM categories
    ORDER BY id
  `);
}

/**
 * Export document-category relationships
 */
export function exportDocumentCategories(): DocumentCategoryRecord[] {
  return queryAll<DocumentCategoryRecord>(`
    SELECT document_id, category_id
    FROM document_categories
    ORDER BY document_id, category_id
  `);
}

/**
 * Export all users
 */
export function exportUsers(): DbUser[] {
  return queryAll<DbUser>(`
    SELECT id, email, name, role, added_by, created_at, updated_at
    FROM users
    ORDER BY id
  `);
}

/**
 * Export user subscriptions
 */
export function exportUserSubscriptions(): UserSubscriptionRecord[] {
  return queryAll<UserSubscriptionRecord>(`
    SELECT user_id, category_id, is_active, subscribed_at, subscribed_by
    FROM user_subscriptions
    ORDER BY user_id, category_id
  `);
}

/**
 * Export super user category assignments
 */
export function exportSuperUserCategories(): SuperUserCategoryRecord[] {
  return queryAll<SuperUserCategoryRecord>(`
    SELECT user_id, category_id, assigned_at, assigned_by
    FROM super_user_categories
    ORDER BY user_id, category_id
  `);
}

/**
 * Export all threads
 */
export function exportThreads(): ThreadRecord[] {
  return queryAll<ThreadRecord>(`
    SELECT id, user_id, title, created_at, updated_at
    FROM threads
    ORDER BY id
  `);
}

/**
 * Export all messages
 */
export function exportMessages(): MessageRecord[] {
  return queryAll<MessageRecord>(`
    SELECT id, thread_id, role, content, sources_json, attachments_json, tool_calls_json, tool_call_id, tool_name, created_at
    FROM messages
    ORDER BY thread_id, created_at
  `);
}

/**
 * Export thread categories
 */
export function exportThreadCategories(): ThreadCategoryRecord[] {
  return queryAll<ThreadCategoryRecord>(`
    SELECT thread_id, category_id
    FROM thread_categories
    ORDER BY thread_id, category_id
  `);
}

/**
 * Export thread uploads
 */
export function exportThreadUploads(): ThreadUploadRecord[] {
  return queryAll<ThreadUploadRecord>(`
    SELECT id, thread_id, filename, filepath, file_size, uploaded_at
    FROM thread_uploads
    ORDER BY id
  `);
}

/**
 * Export thread outputs
 */
export function exportThreadOutputs(): ThreadOutputRecord[] {
  return queryAll<ThreadOutputRecord>(`
    SELECT id, thread_id, message_id, filename, filepath, file_type, file_size, created_at
    FROM thread_outputs
    ORDER BY id
  `);
}

/**
 * Export all settings
 */
export function exportSettings(): SettingRecord[] {
  return queryAll<SettingRecord>(`
    SELECT key, value, updated_at, updated_by
    FROM settings
    ORDER BY key
  `);
}

/**
 * Check if .env file exists
 */
export function checkEnvFileExists(): boolean {
  const envPath = path.join(process.cwd(), '.env');
  try {
    return fs.existsSync(envPath);
  } catch {
    return false;
  }
}

/**
 * Export .env file content (sanitized keys only on export, full content for backup)
 */
export function exportEnvFile(): string | null {
  const envPath = path.join(process.cwd(), '.env');
  try {
    if (fs.existsSync(envPath)) {
      return fs.readFileSync(envPath, 'utf-8');
    }
  } catch {
    // Ignore errors
  }
  return null;
}

// ============ Import Functions ============

/**
 * Import documents (preserves IDs)
 */
export function importDocuments(records: DbDocument[]): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO documents (id, filename, filepath, file_size, is_global, chunk_count, status, error_message, uploaded_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const doc of records) {
    stmt.run(
      doc.id,
      doc.filename,
      doc.filepath,
      doc.file_size,
      doc.is_global,
      doc.chunk_count,
      doc.status,
      doc.error_message,
      doc.uploaded_by,
      doc.created_at
    );
  }
}

/**
 * Import categories (preserves IDs)
 */
export function importCategories(records: DbCategory[]): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO categories (id, name, slug, description, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const cat of records) {
    stmt.run(
      cat.id,
      cat.name,
      cat.slug,
      cat.description,
      cat.created_by,
      cat.created_at
    );
  }
}

/**
 * Import document-category relationships
 */
export function importDocumentCategories(records: DocumentCategoryRecord[]): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO document_categories (document_id, category_id)
    VALUES (?, ?)
  `);

  for (const rec of records) {
    stmt.run(rec.document_id, rec.category_id);
  }
}

/**
 * Import users (preserves IDs)
 */
export function importUsers(records: DbUser[]): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO users (id, email, name, role, added_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const user of records) {
    stmt.run(
      user.id,
      user.email,
      user.name,
      user.role,
      user.added_by,
      user.created_at,
      user.updated_at
    );
  }
}

/**
 * Import user subscriptions
 */
export function importUserSubscriptions(records: UserSubscriptionRecord[]): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO user_subscriptions (user_id, category_id, is_active, subscribed_at, subscribed_by)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const rec of records) {
    stmt.run(
      rec.user_id,
      rec.category_id,
      rec.is_active,
      rec.subscribed_at,
      rec.subscribed_by
    );
  }
}

/**
 * Import super user category assignments
 */
export function importSuperUserCategories(records: SuperUserCategoryRecord[]): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO super_user_categories (user_id, category_id, assigned_at, assigned_by)
    VALUES (?, ?, ?, ?)
  `);

  for (const rec of records) {
    stmt.run(
      rec.user_id,
      rec.category_id,
      rec.assigned_at,
      rec.assigned_by
    );
  }
}

/**
 * Import threads (preserves IDs)
 */
export function importThreads(records: ThreadRecord[]): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO threads (id, user_id, title, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const thread of records) {
    stmt.run(
      thread.id,
      thread.user_id,
      thread.title,
      thread.created_at,
      thread.updated_at
    );
  }
}

/**
 * Import messages
 */
export function importMessages(records: MessageRecord[]): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO messages (id, thread_id, role, content, sources_json, attachments_json, tool_calls_json, tool_call_id, tool_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const msg of records) {
    stmt.run(
      msg.id,
      msg.thread_id,
      msg.role,
      msg.content,
      msg.sources_json,
      msg.attachments_json,
      msg.tool_calls_json,
      msg.tool_call_id,
      msg.tool_name,
      msg.created_at
    );
  }
}

/**
 * Import thread categories
 */
export function importThreadCategories(records: ThreadCategoryRecord[]): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO thread_categories (thread_id, category_id)
    VALUES (?, ?)
  `);

  for (const rec of records) {
    stmt.run(rec.thread_id, rec.category_id);
  }
}

/**
 * Import thread uploads
 */
export function importThreadUploads(records: ThreadUploadRecord[]): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO thread_uploads (id, thread_id, filename, filepath, file_size, uploaded_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const rec of records) {
    stmt.run(
      rec.id,
      rec.thread_id,
      rec.filename,
      rec.filepath,
      rec.file_size,
      rec.uploaded_at
    );
  }
}

/**
 * Import thread outputs
 */
export function importThreadOutputs(records: ThreadOutputRecord[]): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO thread_outputs (id, thread_id, message_id, filename, filepath, file_type, file_size, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const rec of records) {
    stmt.run(
      rec.id,
      rec.thread_id,
      rec.message_id,
      rec.filename,
      rec.filepath,
      rec.file_type,
      rec.file_size,
      rec.created_at
    );
  }
}

/**
 * Import settings
 */
export function importSettings(records: SettingRecord[]): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO settings (key, value, updated_at, updated_by)
    VALUES (?, ?, ?, ?)
  `);

  for (const setting of records) {
    stmt.run(
      setting.key,
      setting.value,
      setting.updated_at,
      setting.updated_by
    );
  }
}

/**
 * Restore .env file
 */
export function restoreEnvFile(content: string): void {
  const envPath = path.join(process.cwd(), '.env');
  fs.writeFileSync(envPath, content, 'utf-8');
}

// ============ Clear Functions ============

/**
 * Clear all data from tables (for fresh restore)
 * Respects foreign key constraints by deleting in correct order
 */
export function clearAllData(): void {
  transaction(() => {
    // Clear thread-related tables first (depend on threads)
    execute('DELETE FROM thread_outputs');
    execute('DELETE FROM thread_uploads');
    execute('DELETE FROM thread_categories');
    execute('DELETE FROM messages');
    execute('DELETE FROM threads');

    // Clear document relationships
    execute('DELETE FROM document_categories');
    execute('DELETE FROM documents');

    // Clear user relationships
    execute('DELETE FROM user_subscriptions');
    execute('DELETE FROM super_user_categories');
    execute('DELETE FROM users');

    // Clear categories
    execute('DELETE FROM categories');

    // Clear settings
    execute('DELETE FROM settings');

    // Clear storage alerts
    execute('DELETE FROM storage_alerts');
  });
}

/**
 * Clear only document-related data
 */
export function clearDocumentData(): void {
  transaction(() => {
    execute('DELETE FROM document_categories');
    execute('DELETE FROM documents');
  });
}

/**
 * Clear only user-related data
 */
export function clearUserData(): void {
  transaction(() => {
    execute('DELETE FROM user_subscriptions');
    execute('DELETE FROM super_user_categories');
    execute('DELETE FROM users');
  });
}

/**
 * Clear only thread-related data
 */
export function clearThreadData(): void {
  transaction(() => {
    execute('DELETE FROM thread_outputs');
    execute('DELETE FROM thread_uploads');
    execute('DELETE FROM thread_categories');
    execute('DELETE FROM messages');
    execute('DELETE FROM threads');
  });
}

/**
 * Clear settings only
 */
export function clearSettings(): void {
  execute('DELETE FROM settings');
}

/**
 * Clear categories (also removes document_categories due to ON DELETE SET NULL)
 */
export function clearCategories(): void {
  execute('DELETE FROM categories');
}
