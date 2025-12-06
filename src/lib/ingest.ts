/**
 * Document Ingestion Module
 *
 * Supports category-based document ingestion with SQLite metadata storage.
 * Documents can be assigned to categories or marked as global.
 * Global documents are indexed into all category collections.
 *
 * Supports: PDF, DOCX, XLSX, PPTX, PNG, JPG, WEBP, GIF
 */

import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import path from 'path';
import { createEmbeddings } from './openai';
import {
  addDocuments,
  addDocumentsToCategories,
  addGlobalDocuments,
  deleteDocumentsByFilter,
  deleteDocumentsByFilterFromCategories,
  deleteDocumentsFromAllCollections,
} from './chroma';
import { readFileBuffer, getGlobalDocsDir, deleteFile, fileExists, writeFileBuffer } from './storage';
import { getRagSettings } from './db/config';
import {
  createDocument,
  getDocumentWithCategories,
  getAllDocumentsWithCategories,
  updateDocument,
  deleteDocument as dbDeleteDocument,
  setDocumentCategories,
  setDocumentGlobal,
  type DocumentWithCategories,
} from './db/documents';
import { getCategoryById } from './db/categories';
import { extractText, getMimeTypeFromFilename, type ExtractedPage } from './document-extractor';
import type { DocumentChunk, GlobalDocument } from '@/types';

// Create splitter with configurable settings
function createSplitter(chunkSize?: number, chunkOverlap?: number): RecursiveCharacterTextSplitter {
  if (chunkSize !== undefined && chunkOverlap !== undefined) {
    return new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
      separators: ['\n\n', '\n', '. ', ' ', ''],
    });
  }

  const settings = getRagSettings();
  return new RecursiveCharacterTextSplitter({
    chunkSize: settings.chunkSize,
    chunkOverlap: settings.chunkOverlap,
    separators: ['\n\n', '\n', '. ', ' ', ''],
  });
}

// Re-export PageText type for backward compatibility
export type PageText = ExtractedPage;

/**
 * Extract text from a PDF document
 * @deprecated Use extractText from document-extractor.ts for new code
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<{ text: string; numPages: number; pages: PageText[] }> {
  return extractText(buffer, 'application/pdf', 'document.pdf');
}

/**
 * Extract text from any supported document type
 */
export async function extractTextFromDocument(
  buffer: Buffer,
  filename: string,
  mimeType?: string
): Promise<{ text: string; numPages: number; pages: PageText[] }> {
  const resolvedMimeType = mimeType || getMimeTypeFromFilename(filename);
  return extractText(buffer, resolvedMimeType, filename);
}

export async function chunkText(
  text: string,
  documentId: string,
  documentName: string,
  source: 'global' | 'user' = 'global',
  threadId?: string,
  userId?: string,
  pages?: PageText[]
): Promise<DocumentChunk[]> {
  // Get splitter with current settings
  const splitter = createSplitter();

  // If we have page information, chunk each page separately to preserve page numbers
  if (pages && pages.length > 0) {
    const allChunks: DocumentChunk[] = [];
    let chunkIndex = 0;

    for (const page of pages) {
      if (!page.text.trim()) continue;

      const pageChunks = await splitter.splitText(page.text);

      for (const chunkText of pageChunks) {
        allChunks.push({
          id: `${documentId}-chunk-${chunkIndex}`,
          text: chunkText,
          metadata: {
            documentId,
            documentName,
            pageNumber: page.pageNumber,
            chunkIndex,
            source,
            threadId,
            userId,
          },
        });
        chunkIndex++;
      }
    }

    return allChunks;
  }

  // Fallback: chunk without page info (all page 1)
  const chunks = await splitter.splitText(text);

  return chunks.map((chunk, index) => ({
    id: `${documentId}-chunk-${index}`,
    text: chunk,
    metadata: {
      documentId,
      documentName,
      pageNumber: 1,
      chunkIndex: index,
      source,
      threadId,
      userId,
    },
  }));
}

/**
 * Convert SQLite document to API format for backward compatibility
 */
function toGlobalDocument(doc: DocumentWithCategories): GlobalDocument {
  return {
    id: String(doc.id),
    filename: doc.filename,
    filepath: doc.filepath,
    size: doc.file_size,
    chunkCount: doc.chunk_count,
    uploadedAt: new Date(doc.created_at),
    uploadedBy: doc.uploaded_by,
    status: doc.status,
    errorMessage: doc.error_message || undefined,
    isGlobal: doc.isGlobal,
    categories: doc.categories,
  };
}

/**
 * Ingest a document with category support
 *
 * @param buffer - File buffer
 * @param filename - Original filename
 * @param uploadedBy - User email who uploaded
 * @param options - Category, global, and MIME type options
 */
export async function ingestDocument(
  buffer: Buffer,
  filename: string,
  uploadedBy: string,
  options?: {
    categoryIds?: number[];
    isGlobal?: boolean;
    mimeType?: string;
  }
): Promise<GlobalDocument> {
  const globalDocsDir = getGlobalDocsDir();
  const categoryIds = options?.categoryIds || [];
  const isGlobal = options?.isGlobal || false;
  const mimeType = options?.mimeType || getMimeTypeFromFilename(filename);

  // Save file
  const filePath = path.join(globalDocsDir, filename);
  await writeFileBuffer(filePath, buffer);

  // Create document record in SQLite
  const doc = createDocument({
    filename,
    filepath: filename,
    fileSize: buffer.length,
    uploadedBy,
    isGlobal,
    categoryIds,
  });

  try {
    // Extract and chunk text
    const { text, pages } = await extractText(buffer, mimeType, filename);
    const docId = String(doc.id);
    const chunks = await chunkText(text, docId, filename, 'global', undefined, undefined, pages);

    if (chunks.length === 0) {
      throw new Error('No text content extracted from document');
    }

    // Get category slugs for ChromaDB collection names
    const categorySlugs: string[] = [];
    for (const catId of categoryIds) {
      const category = getCategoryById(catId);
      if (category) {
        categorySlugs.push(category.slug);
      }
    }

    // Create embeddings in batches
    const batchSize = 100;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const texts = batch.map(c => c.text);
      const embeddings = await createEmbeddings(texts);
      const metadatas = batch.map(c => c.metadata);

      if (isGlobal) {
        // Global documents go into all category collections
        await addGlobalDocuments(
          batch.map(c => c.id),
          embeddings,
          texts,
          metadatas
        );
      } else if (categorySlugs.length > 0) {
        // Category-specific documents
        await addDocumentsToCategories(
          categorySlugs,
          batch.map(c => c.id),
          embeddings,
          texts,
          metadatas,
          false
        );
      } else {
        // Legacy: add to default collection (for uncategorized documents)
        await addDocuments(
          batch.map(c => c.id),
          embeddings,
          texts,
          metadatas
        );
      }
    }

    // Update document status
    updateDocument(doc.id, {
      chunkCount: chunks.length,
      status: 'ready',
    });

    // Fetch updated document
    const updatedDoc = getDocumentWithCategories(doc.id);
    return toGlobalDocument(updatedDoc!);
  } catch (error) {
    // Update document with error status
    updateDocument(doc.id, {
      status: 'error',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    throw error;
  }
}

/**
 * Delete a document and its embeddings
 */
export async function deleteDocument(docId: string): Promise<{ filename: string; chunksRemoved: number } | null> {
  const numericId = parseInt(docId, 10);
  const doc = getDocumentWithCategories(numericId);

  if (!doc) {
    return null;
  }

  // Get category slugs for deletion
  const categorySlugs = doc.categories.map(c => c.slug);

  // Delete from ChromaDB
  if (doc.isGlobal) {
    // Global doc: delete from all collections
    await deleteDocumentsFromAllCollections([docId]);
  } else if (categorySlugs.length > 0) {
    // Category doc: delete from specific collections
    await deleteDocumentsByFilterFromCategories(categorySlugs, { documentId: docId });
  } else {
    // Legacy: delete from default collection
    await deleteDocumentsByFilter({ documentId: docId });
  }

  // Delete PDF file
  const globalDocsDir = getGlobalDocsDir();
  const pdfPath = path.join(globalDocsDir, doc.filepath);
  await deleteFile(pdfPath);

  // Delete from SQLite
  dbDeleteDocument(numericId);

  return {
    filename: doc.filename,
    chunksRemoved: doc.chunk_count,
  };
}

/**
 * Reindex a document (re-extract and re-embed)
 */
export async function reindexDocument(docId: string): Promise<GlobalDocument | null> {
  const numericId = parseInt(docId, 10);
  const doc = getDocumentWithCategories(numericId);

  if (!doc) {
    return null;
  }

  const globalDocsDir = getGlobalDocsDir();
  const pdfPath = path.join(globalDocsDir, doc.filepath);

  if (!await fileExists(pdfPath)) {
    throw new Error('PDF file not found');
  }

  // Get category slugs
  const categorySlugs = doc.categories.map(c => c.slug);

  // Delete existing embeddings
  if (doc.isGlobal) {
    await deleteDocumentsFromAllCollections([docId]);
  } else if (categorySlugs.length > 0) {
    await deleteDocumentsByFilterFromCategories(categorySlugs, { documentId: docId });
  } else {
    await deleteDocumentsByFilter({ documentId: docId });
  }

  // Update status to processing
  updateDocument(numericId, { status: 'processing' });

  try {
    // Re-extract and chunk
    const buffer = await readFileBuffer(pdfPath);
    const mimeType = getMimeTypeFromFilename(doc.filename);
    const { text, pages } = await extractText(buffer, mimeType, doc.filename);
    const chunks = await chunkText(text, docId, doc.filename, 'global', undefined, undefined, pages);

    // Create embeddings in batches
    const batchSize = 100;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const texts = batch.map(c => c.text);
      const embeddings = await createEmbeddings(texts);
      const metadatas = batch.map(c => c.metadata);

      if (doc.isGlobal) {
        await addGlobalDocuments(
          batch.map(c => c.id),
          embeddings,
          texts,
          metadatas
        );
      } else if (categorySlugs.length > 0) {
        await addDocumentsToCategories(
          categorySlugs,
          batch.map(c => c.id),
          embeddings,
          texts,
          metadatas,
          false
        );
      } else {
        await addDocuments(
          batch.map(c => c.id),
          embeddings,
          texts,
          metadatas
        );
      }
    }

    // Update document status
    updateDocument(numericId, {
      chunkCount: chunks.length,
      status: 'ready',
      errorMessage: null,
    });

    const updatedDoc = getDocumentWithCategories(numericId);
    return toGlobalDocument(updatedDoc!);
  } catch (error) {
    updateDocument(numericId, {
      status: 'error',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    throw error;
  }
}

/**
 * List all global documents
 */
export async function listGlobalDocuments(): Promise<GlobalDocument[]> {
  const docs = getAllDocumentsWithCategories();
  return docs.map(toGlobalDocument);
}

/**
 * Get a specific document
 */
export async function getGlobalDocument(docId: string): Promise<GlobalDocument | null> {
  const numericId = parseInt(docId, 10);
  const doc = getDocumentWithCategories(numericId);
  return doc ? toGlobalDocument(doc) : null;
}

// ============ Category Management Functions ============

/**
 * Update document categories
 * This will re-index the document to the new categories
 */
export async function updateDocumentCategories(
  docId: string,
  categoryIds: number[]
): Promise<void> {
  const numericId = parseInt(docId, 10);
  const doc = getDocumentWithCategories(numericId);

  if (!doc) {
    throw new Error('Document not found');
  }

  // Get old and new category slugs
  const oldSlugs = doc.categories.map(c => c.slug);
  const newSlugs: string[] = [];
  for (const catId of categoryIds) {
    const category = getCategoryById(catId);
    if (category) {
      newSlugs.push(category.slug);
    }
  }

  // If document has embeddings and categories changed, need to re-index
  if (doc.chunk_count > 0 && doc.status === 'ready') {
    // Delete from old categories
    if (oldSlugs.length > 0) {
      await deleteDocumentsByFilterFromCategories(oldSlugs, { documentId: docId });
    }

    // Re-add to new categories
    if (newSlugs.length > 0) {
      const globalDocsDir = getGlobalDocsDir();
      const filePath = path.join(globalDocsDir, doc.filepath);
      const buffer = await readFileBuffer(filePath);
      const mimeType = getMimeTypeFromFilename(doc.filename);
      const { text, pages } = await extractText(buffer, mimeType, doc.filename);
      const chunks = await chunkText(text, docId, doc.filename, 'global', undefined, undefined, pages);

      const batchSize = 100;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const texts = batch.map(c => c.text);
        const embeddings = await createEmbeddings(texts);

        await addDocumentsToCategories(
          newSlugs,
          batch.map(c => c.id),
          embeddings,
          texts,
          batch.map(c => c.metadata),
          false
        );
      }
    }
  }

  // Update SQLite
  setDocumentCategories(numericId, categoryIds);
}

/**
 * Toggle document global status
 * Global documents are indexed into all category collections
 */
export async function toggleDocumentGlobal(
  docId: string,
  isGlobal: boolean
): Promise<void> {
  const numericId = parseInt(docId, 10);
  const doc = getDocumentWithCategories(numericId);

  if (!doc) {
    throw new Error('Document not found');
  }

  // If document has embeddings and status is changing, need to re-index
  if (doc.chunk_count > 0 && doc.status === 'ready' && doc.isGlobal !== isGlobal) {
    const globalDocsDir = getGlobalDocsDir();
    const filePath = path.join(globalDocsDir, doc.filepath);
    const buffer = await readFileBuffer(filePath);
    const mimeType = getMimeTypeFromFilename(doc.filename);
    const { text, pages } = await extractText(buffer, mimeType, doc.filename);
    const chunks = await chunkText(text, docId, doc.filename, 'global', undefined, undefined, pages);

    // Delete from current locations
    if (doc.isGlobal) {
      await deleteDocumentsFromAllCollections([docId]);
    } else {
      const oldSlugs = doc.categories.map(c => c.slug);
      if (oldSlugs.length > 0) {
        await deleteDocumentsByFilterFromCategories(oldSlugs, { documentId: docId });
      }
    }

    // Re-add to new locations
    const batchSize = 100;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const texts = batch.map(c => c.text);
      const embeddings = await createEmbeddings(texts);

      if (isGlobal) {
        await addGlobalDocuments(
          batch.map(c => c.id),
          embeddings,
          texts,
          batch.map(c => c.metadata)
        );
      } else {
        const newSlugs = doc.categories.map(c => c.slug);
        if (newSlugs.length > 0) {
          await addDocumentsToCategories(
            newSlugs,
            batch.map(c => c.id),
            embeddings,
            texts,
            batch.map(c => c.metadata),
            false
          );
        }
      }
    }
  }

  // Update SQLite
  setDocumentGlobal(numericId, isGlobal);
}
