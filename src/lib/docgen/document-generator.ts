/**
 * Document Generator - Main orchestrator for document generation
 *
 * Coordinates PDF and Word document generation with:
 * - Branding configuration resolution
 * - Storage management
 * - Expiration handling
 */

import * as fs from 'fs';
import * as path from 'path';
import { generatePdf } from './pdf-builder';
import { generateDocx } from './docx-builder';
import { generateMd } from './md-builder';
import {
  type BrandingConfig,
  mergeBrandingConfigs,
  getOutputDirectory,
  generateDocumentFilename,
} from './branding';
import { execute, queryOne, queryAll } from '../db/index';

// ============ Types ============

export type DocumentFormat = 'pdf' | 'docx' | 'md';

export interface GenerateDocumentOptions {
  title: string;
  content: string;
  format: DocumentFormat;
  threadId?: string;
  messageId?: string;
  categoryId?: number;
  branding?: Partial<BrandingConfig>;
  metadata?: {
    author?: string;
    subject?: string;
    keywords?: string[];
  };
}

export interface GeneratedDocument {
  id: number;
  threadId: string;
  messageId: string | null;
  filename: string;
  filepath: string;
  fileType: DocumentFormat;
  fileSize: number;
  downloadUrl: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface DocGenConfig {
  enabled: boolean;
  defaultFormat: DocumentFormat;
  enabledFormats: DocumentFormat[];
  branding: BrandingConfig;
  expirationDays: number;
  maxDocumentSizeMB: number;
}

// ============ Database Types ============

interface DbThreadOutput {
  id: number;
  thread_id: string;
  message_id: string | null;
  filename: string;
  filepath: string;
  file_type: string;
  file_size: number;
  generation_config: string | null;
  expires_at: string | null;
  download_count: number;
  created_at: string;
}

// ============ Document Generator Class ============

export class DocumentGenerator {
  private config: DocGenConfig;
  private categoryBranding: Partial<BrandingConfig> | null;

  constructor(config: DocGenConfig, categoryBranding?: Partial<BrandingConfig> | null) {
    this.config = config;
    this.categoryBranding = categoryBranding || null;
  }

  /**
   * Generate a document
   */
  async generate(options: GenerateDocumentOptions): Promise<GeneratedDocument> {
    // Validate format
    if (!this.config.enabledFormats.includes(options.format)) {
      throw new Error(`Format '${options.format}' is not enabled. Available formats: ${this.config.enabledFormats.join(', ')}`);
    }

    // Resolve branding configuration
    const branding = mergeBrandingConfigs(
      this.config.branding,
      options.branding || this.categoryBranding
    );

    // Generate document based on format
    let buffer: Buffer;
    let pageCount: number | undefined;

    if (options.format === 'pdf') {
      const result = await generatePdf({
        title: options.title,
        content: options.content,
        branding,
        metadata: options.metadata,
      });
      buffer = result.buffer;
      pageCount = result.pageCount;
    } else if (options.format === 'docx') {
      const result = await generateDocx({
        title: options.title,
        content: options.content,
        branding,
        metadata: options.metadata,
      });
      buffer = result.buffer;
    } else {
      // Markdown format
      const result = await generateMd({
        title: options.title,
        content: options.content,
        branding,
        metadata: {
          author: options.metadata?.author,
          date: new Date().toLocaleDateString(),
        },
      });
      buffer = result.buffer;
    }

    // Check file size limit
    const fileSizeMB = buffer.length / (1024 * 1024);
    if (fileSizeMB > this.config.maxDocumentSizeMB) {
      throw new Error(
        `Generated document (${fileSizeMB.toFixed(2)} MB) exceeds maximum size limit (${this.config.maxDocumentSizeMB} MB)`
      );
    }

    // Generate filename and save to disk
    const filename = generateDocumentFilename(options.title, options.format, options.threadId);
    const outputDir = getOutputDirectory();
    const filepath = path.join(outputDir, filename);

    fs.writeFileSync(filepath, buffer);

    // Calculate expiration date
    const expiresAt = this.config.expirationDays > 0
      ? new Date(Date.now() + this.config.expirationDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // Validate threadId exists if provided (foreign key constraint)
    const effectiveThreadId = options.threadId;
    if (effectiveThreadId) {
      const threadExists = queryOne<{ id: string }>('SELECT id FROM threads WHERE id = ?', [effectiveThreadId]);
      if (!threadExists) {
        console.error('[DocGen] Thread not found in database:', effectiveThreadId);
        throw new Error(`Thread ${effectiveThreadId} not found - cannot save generated document`);
      }
    } else {
      console.warn('[DocGen] No threadId provided - document will not be saved to database');
      // Return early with in-memory result (no database persistence)
      return {
        id: 0, // No database ID
        threadId: undefined,
        messageId: options.messageId || null,
        filename,
        filepath,
        fileType: options.format,
        fileSize: buffer.length,
        downloadUrl: '', // Not accessible without database entry
        expiresAt: null,
        createdAt: new Date().toISOString(),
      } as unknown as GeneratedDocument;
    }

    // Store in database
    const result = execute(
      `INSERT INTO thread_outputs (
        thread_id, message_id, filename, filepath, file_type, file_size,
        generation_config, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        effectiveThreadId,
        options.messageId || null,
        filename,
        filepath,
        options.format,
        buffer.length,
        JSON.stringify({
          title: options.title,
          branding: branding.enabled ? {
            organizationName: branding.organizationName,
            primaryColor: branding.primaryColor,
          } : null,
          pageCount,
        }),
        expiresAt,
      ]
    );

    const docId = result.lastInsertRowid as number;

    return {
      id: docId,
      threadId: effectiveThreadId,
      messageId: options.messageId || null,
      filename,
      filepath,
      fileType: options.format,
      fileSize: buffer.length,
      downloadUrl: `/api/documents/${docId}/download`,
      expiresAt,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Get supported formats
   */
  getSupportedFormats(): DocumentFormat[] {
    return this.config.enabledFormats;
  }

  /**
   * Check if a format is enabled
   */
  isFormatEnabled(format: DocumentFormat): boolean {
    return this.config.enabledFormats.includes(format);
  }
}

// ============ Document Storage Functions ============

/**
 * Get a document by ID
 */
export function getDocument(docId: number): GeneratedDocument | null {
  const row = queryOne<DbThreadOutput>(
    'SELECT * FROM thread_outputs WHERE id = ?',
    [docId]
  );

  if (!row) return null;

  return mapDbToDocument(row);
}

/**
 * Get documents for a thread
 */
export function getThreadDocuments(threadId: string): GeneratedDocument[] {
  const rows = queryAll<DbThreadOutput>(
    'SELECT * FROM thread_outputs WHERE thread_id = ? ORDER BY created_at DESC',
    [threadId]
  );

  return rows.map(mapDbToDocument);
}

/**
 * Get expired documents
 */
export function getExpiredDocuments(): GeneratedDocument[] {
  const rows = queryAll<DbThreadOutput>(
    `SELECT * FROM thread_outputs
     WHERE expires_at IS NOT NULL AND expires_at < datetime('now')
     ORDER BY expires_at ASC`,
    []
  );

  return rows.map(mapDbToDocument);
}

/**
 * Delete a document
 */
export function deleteDocument(docId: number): boolean {
  const doc = getDocument(docId);
  if (!doc) return false;

  // Delete file from disk
  if (fs.existsSync(doc.filepath)) {
    fs.unlinkSync(doc.filepath);
  }

  // Delete from database
  execute('DELETE FROM thread_outputs WHERE id = ?', [docId]);

  return true;
}

/**
 * Clean up expired documents
 */
export function cleanupExpiredDocuments(): number {
  const expired = getExpiredDocuments();
  let deleted = 0;

  for (const doc of expired) {
    if (deleteDocument(doc.id)) {
      deleted++;
    }
  }

  return deleted;
}

/**
 * Increment download count for a document
 */
export function incrementDownloadCount(docId: number): void {
  execute(
    'UPDATE thread_outputs SET download_count = download_count + 1 WHERE id = ?',
    [docId]
  );
}

/**
 * Get download count for a document
 */
export function getDownloadCount(docId: number): number {
  const row = queryOne<{ download_count: number }>(
    'SELECT download_count FROM thread_outputs WHERE id = ?',
    [docId]
  );
  return row?.download_count ?? 0;
}

// ============ Mappers ============

function mapDbToDocument(row: DbThreadOutput): GeneratedDocument {
  return {
    id: row.id,
    threadId: row.thread_id,
    messageId: row.message_id,
    filename: row.filename,
    filepath: row.filepath,
    fileType: row.file_type as DocumentFormat,
    fileSize: row.file_size,
    downloadUrl: `/api/documents/${row.id}/download`,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

// ============ Factory Function ============

/**
 * Create a document generator with config from database
 */
export function createDocumentGenerator(
  config: DocGenConfig,
  categoryBranding?: Partial<BrandingConfig> | null
): DocumentGenerator {
  return new DocumentGenerator(config, categoryBranding);
}

// ============ Export Types ============

export type { BrandingConfig } from './branding';
