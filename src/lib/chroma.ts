import { ChromaClient, Collection, Metadata, IncludeEnum } from 'chromadb';
import type { ChunkMetadata } from '@/types';

const COLLECTION_NAME = process.env.CHROMA_COLLECTION_NAME || 'organizational_documents';

let client: ChromaClient | null = null;
let collection: Collection | null = null;

export async function getChromaClient(): Promise<ChromaClient> {
  if (!client) {
    const host = process.env.CHROMA_HOST || 'localhost';
    const port = process.env.CHROMA_PORT || '8000';
    client = new ChromaClient({
      path: `http://${host}:${port}`,
    });
  }
  return client;
}

export async function getCollection(): Promise<Collection> {
  if (!collection) {
    const chromaClient = await getChromaClient();
    collection = await chromaClient.getOrCreateCollection({
      name: COLLECTION_NAME,
      metadata: { 'hnsw:space': 'cosine' },
    });
  }
  return collection;
}

export async function addDocuments(
  ids: string[],
  embeddings: number[][],
  documents: string[],
  metadatas: ChunkMetadata[]
): Promise<void> {
  const coll = await getCollection();
  await coll.add({
    ids,
    embeddings,
    documents,
    metadatas: metadatas as unknown as Metadata[],
  });
}

export async function queryDocuments(
  queryEmbedding: number[],
  nResults: number = 5,
  whereFilter?: Record<string, unknown>
): Promise<{
  ids: string[];
  documents: string[];
  metadatas: ChunkMetadata[];
  distances: number[];
}> {
  const coll = await getCollection();
  const results = await coll.query({
    queryEmbeddings: [queryEmbedding],
    nResults,
    where: whereFilter,
    include: [IncludeEnum.Documents, IncludeEnum.Metadatas, IncludeEnum.Distances],
  });

  return {
    ids: (results.ids[0] || []) as string[],
    documents: (results.documents?.[0] || []) as string[],
    metadatas: (results.metadatas?.[0] || []) as unknown as ChunkMetadata[],
    distances: (results.distances?.[0] || []) as number[],
  };
}

export async function deleteDocuments(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const coll = await getCollection();
  await coll.delete({ ids });
}

export async function deleteDocumentsByFilter(
  whereFilter: Record<string, unknown>
): Promise<void> {
  const coll = await getCollection();
  await coll.delete({ where: whereFilter });
}

export async function getDocumentCount(): Promise<number> {
  const coll = await getCollection();
  return coll.count();
}
