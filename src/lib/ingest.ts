import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import pdf from 'pdf-parse';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createEmbeddings } from './openai';
import { addDocuments, deleteDocumentsByFilter } from './chroma';
import { readJson, writeJson, readFileBuffer, getGlobalDocsDir, deleteFile, fileExists } from './storage';
import type { DocumentChunk, GlobalDocument, DocumentRegistry } from '@/types';

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP,
  separators: ['\n\n', '\n', '. ', ' ', ''],
});

export async function extractTextFromPDF(buffer: Buffer): Promise<{ text: string; numPages: number }> {
  const data = await pdf(buffer);
  return {
    text: data.text,
    numPages: data.numpages,
  };
}

export async function chunkText(
  text: string,
  documentId: string,
  documentName: string,
  source: 'global' | 'user' = 'global',
  threadId?: string,
  userId?: string
): Promise<DocumentChunk[]> {
  const chunks = await splitter.splitText(text);

  return chunks.map((chunk, index) => ({
    id: `${documentId}-chunk-${index}`,
    text: chunk,
    metadata: {
      documentId,
      documentName,
      pageNumber: 1, // Simplified - could enhance with page boundary detection
      chunkIndex: index,
      source,
      threadId,
      userId,
    },
  }));
}

export async function ingestDocument(
  buffer: Buffer,
  filename: string,
  uploadedBy: string
): Promise<GlobalDocument> {
  const docId = uuidv4();
  const globalDocsDir = getGlobalDocsDir();

  // Save PDF
  const { writeFileBuffer } = await import('./storage');
  const pdfPath = path.join(globalDocsDir, filename);
  await writeFileBuffer(pdfPath, buffer);

  // Create document record
  const doc: GlobalDocument = {
    id: docId,
    filename,
    filepath: filename,
    size: buffer.length,
    chunkCount: 0,
    uploadedAt: new Date(),
    uploadedBy,
    status: 'processing',
  };

  // Update registry
  const registryPath = path.join(globalDocsDir, 'registry.json');
  const registry = await readJson<DocumentRegistry>(registryPath) || { documents: [] };
  registry.documents.push(doc);
  await writeJson(registryPath, registry);

  try {
    // Extract and chunk text
    const { text } = await extractTextFromPDF(buffer);
    const chunks = await chunkText(text, docId, filename, 'global');

    if (chunks.length === 0) {
      throw new Error('No text content extracted from PDF');
    }

    // Create embeddings in batches
    const batchSize = 100;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const texts = batch.map(c => c.text);
      const embeddings = await createEmbeddings(texts);

      await addDocuments(
        batch.map(c => c.id),
        embeddings,
        texts,
        batch.map(c => c.metadata)
      );
    }

    // Update document status
    doc.chunkCount = chunks.length;
    doc.status = 'ready';

    const updatedRegistry = await readJson<DocumentRegistry>(registryPath) || { documents: [] };
    const docIndex = updatedRegistry.documents.findIndex(d => d.id === docId);
    if (docIndex >= 0) {
      updatedRegistry.documents[docIndex] = doc;
      await writeJson(registryPath, updatedRegistry);
    }

    return doc;
  } catch (error) {
    // Update document with error status
    doc.status = 'error';
    doc.errorMessage = error instanceof Error ? error.message : 'Unknown error';

    const updatedRegistry = await readJson<DocumentRegistry>(registryPath) || { documents: [] };
    const docIndex = updatedRegistry.documents.findIndex(d => d.id === docId);
    if (docIndex >= 0) {
      updatedRegistry.documents[docIndex] = doc;
      await writeJson(registryPath, updatedRegistry);
    }

    throw error;
  }
}

export async function deleteDocument(docId: string): Promise<{ filename: string; chunksRemoved: number } | null> {
  const globalDocsDir = getGlobalDocsDir();
  const registryPath = path.join(globalDocsDir, 'registry.json');
  const registry = await readJson<DocumentRegistry>(registryPath) || { documents: [] };

  const docIndex = registry.documents.findIndex(d => d.id === docId);
  if (docIndex < 0) {
    return null;
  }

  const doc = registry.documents[docIndex];

  // Delete from ChromaDB
  await deleteDocumentsByFilter({ documentId: docId });

  // Delete PDF file
  const pdfPath = path.join(globalDocsDir, doc.filepath);
  await deleteFile(pdfPath);

  // Update registry
  registry.documents.splice(docIndex, 1);
  await writeJson(registryPath, registry);

  return {
    filename: doc.filename,
    chunksRemoved: doc.chunkCount,
  };
}

export async function reindexDocument(docId: string): Promise<GlobalDocument | null> {
  const globalDocsDir = getGlobalDocsDir();
  const registryPath = path.join(globalDocsDir, 'registry.json');
  const registry = await readJson<DocumentRegistry>(registryPath) || { documents: [] };

  const docIndex = registry.documents.findIndex(d => d.id === docId);
  if (docIndex < 0) {
    return null;
  }

  const doc = registry.documents[docIndex];
  const pdfPath = path.join(globalDocsDir, doc.filepath);

  if (!await fileExists(pdfPath)) {
    throw new Error('PDF file not found');
  }

  // Delete existing chunks
  await deleteDocumentsByFilter({ documentId: docId });

  // Update status
  doc.status = 'processing';
  registry.documents[docIndex] = doc;
  await writeJson(registryPath, registry);

  try {
    // Re-extract and chunk
    const buffer = await readFileBuffer(pdfPath);
    const { text } = await extractTextFromPDF(buffer);
    const chunks = await chunkText(text, docId, doc.filename, 'global');

    // Create embeddings in batches
    const batchSize = 100;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const texts = batch.map(c => c.text);
      const embeddings = await createEmbeddings(texts);

      await addDocuments(
        batch.map(c => c.id),
        embeddings,
        texts,
        batch.map(c => c.metadata)
      );
    }

    // Update document status
    doc.chunkCount = chunks.length;
    doc.status = 'ready';
    doc.errorMessage = undefined;

    const updatedRegistry = await readJson<DocumentRegistry>(registryPath) || { documents: [] };
    const updatedDocIndex = updatedRegistry.documents.findIndex(d => d.id === docId);
    if (updatedDocIndex >= 0) {
      updatedRegistry.documents[updatedDocIndex] = doc;
      await writeJson(registryPath, updatedRegistry);
    }

    return doc;
  } catch (error) {
    doc.status = 'error';
    doc.errorMessage = error instanceof Error ? error.message : 'Unknown error';

    const updatedRegistry = await readJson<DocumentRegistry>(registryPath) || { documents: [] };
    const updatedDocIndex = updatedRegistry.documents.findIndex(d => d.id === docId);
    if (updatedDocIndex >= 0) {
      updatedRegistry.documents[updatedDocIndex] = doc;
      await writeJson(registryPath, updatedRegistry);
    }

    throw error;
  }
}

export async function listGlobalDocuments(): Promise<GlobalDocument[]> {
  const globalDocsDir = getGlobalDocsDir();
  const registryPath = path.join(globalDocsDir, 'registry.json');
  const registry = await readJson<DocumentRegistry>(registryPath) || { documents: [] };
  return registry.documents;
}

export async function getGlobalDocument(docId: string): Promise<GlobalDocument | null> {
  const documents = await listGlobalDocuments();
  return documents.find(d => d.id === docId) || null;
}
