import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import type { Thread, ThreadWithMessages, Message, ThreadMetadata, StoredMessage } from '@/types';
import {
  getThreadDir,
  getThreadUploadsDir,
  getUserThreadsDir,
  ensureDir,
  readJson,
  writeJson,
  deleteDir,
  listDirs,
  listFiles,
  deleteFile,
} from './storage';

const MAX_UPLOADS_PER_THREAD = 3;
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5MB

function parseDate(dateString: string): Date {
  return new Date(dateString);
}

function toStoredMessage(message: Message): StoredMessage {
  return {
    ...message,
    timestamp: message.timestamp.toISOString(),
  };
}

function fromStoredMessage(stored: StoredMessage): Message {
  return {
    ...stored,
    timestamp: parseDate(stored.timestamp),
  };
}

function fromMetadata(metadata: ThreadMetadata): Thread {
  return {
    id: metadata.id,
    userId: metadata.userId,
    title: metadata.title,
    createdAt: parseDate(metadata.createdAt),
    updatedAt: parseDate(metadata.updatedAt),
    uploadCount: metadata.uploadCount,
  };
}

export async function createThread(userId: string, title?: string): Promise<Thread> {
  const threadId = uuidv4();
  const now = new Date();

  const metadata: ThreadMetadata = {
    id: threadId,
    userId,
    title: title || 'New Thread',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    uploadCount: 0,
  };

  const threadDir = getThreadDir(userId, threadId);
  await ensureDir(threadDir);
  await ensureDir(getThreadUploadsDir(userId, threadId));

  await writeJson(path.join(threadDir, 'metadata.json'), metadata);
  await writeJson(path.join(threadDir, 'messages.json'), []);

  return fromMetadata(metadata);
}

export async function getThread(userId: string, threadId: string): Promise<ThreadWithMessages | null> {
  const threadDir = getThreadDir(userId, threadId);
  const metadata = await readJson<ThreadMetadata>(path.join(threadDir, 'metadata.json'));

  if (!metadata || metadata.userId !== userId) {
    return null;
  }

  const storedMessages = await readJson<StoredMessage[]>(path.join(threadDir, 'messages.json')) || [];
  const uploads = await listFiles(getThreadUploadsDir(userId, threadId));

  return {
    ...fromMetadata(metadata),
    messages: storedMessages.map(fromStoredMessage),
    uploads: uploads.filter(f => f.endsWith('.pdf')),
  };
}

export async function listThreads(userId: string): Promise<Thread[]> {
  const userDir = getUserThreadsDir(userId);
  const threadIds = await listDirs(userDir);

  const threads: Thread[] = [];

  for (const threadId of threadIds) {
    const threadDir = getThreadDir(userId, threadId);
    const metadata = await readJson<ThreadMetadata>(path.join(threadDir, 'metadata.json'));
    if (metadata && metadata.userId === userId) {
      threads.push(fromMetadata(metadata));
    }
  }

  // Sort by updatedAt descending
  threads.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return threads;
}

export async function deleteThread(userId: string, threadId: string): Promise<{ messageCount: number; uploadCount: number } | null> {
  const thread = await getThread(userId, threadId);
  if (!thread) {
    return null;
  }

  const threadDir = getThreadDir(userId, threadId);
  await deleteDir(threadDir);

  return {
    messageCount: thread.messages.length,
    uploadCount: thread.uploadCount,
  };
}

export async function updateThreadTitle(userId: string, threadId: string, title: string): Promise<Thread | null> {
  const threadDir = getThreadDir(userId, threadId);
  const metadata = await readJson<ThreadMetadata>(path.join(threadDir, 'metadata.json'));

  if (!metadata || metadata.userId !== userId) {
    return null;
  }

  metadata.title = title.substring(0, 100); // Max 100 characters
  metadata.updatedAt = new Date().toISOString();

  await writeJson(path.join(threadDir, 'metadata.json'), metadata);

  return fromMetadata(metadata);
}

export async function addMessage(userId: string, threadId: string, message: Message): Promise<void> {
  const threadDir = getThreadDir(userId, threadId);
  const metadata = await readJson<ThreadMetadata>(path.join(threadDir, 'metadata.json'));

  if (!metadata || metadata.userId !== userId) {
    throw new Error('Thread not found');
  }

  const storedMessages = await readJson<StoredMessage[]>(path.join(threadDir, 'messages.json')) || [];
  storedMessages.push(toStoredMessage(message));

  await writeJson(path.join(threadDir, 'messages.json'), storedMessages);

  // Update title if this is the first user message
  if (storedMessages.length === 1 && message.role === 'user' && metadata.title === 'New Thread') {
    // Generate title from first message
    const title = message.content.substring(0, 50) + (message.content.length > 50 ? '...' : '');
    metadata.title = title;
  }

  metadata.updatedAt = new Date().toISOString();
  await writeJson(path.join(threadDir, 'metadata.json'), metadata);
}

export async function getMessages(userId: string, threadId: string, limit?: number): Promise<Message[]> {
  const threadDir = getThreadDir(userId, threadId);
  const storedMessages = await readJson<StoredMessage[]>(path.join(threadDir, 'messages.json')) || [];
  const messages = storedMessages.map(fromStoredMessage);

  if (limit && limit > 0) {
    return messages.slice(-limit);
  }

  return messages;
}

export async function saveUpload(
  userId: string,
  threadId: string,
  filename: string,
  buffer: Buffer
): Promise<{ filename: string; uploadCount: number }> {
  const threadDir = getThreadDir(userId, threadId);
  const metadata = await readJson<ThreadMetadata>(path.join(threadDir, 'metadata.json'));

  if (!metadata || metadata.userId !== userId) {
    throw new Error('Thread not found');
  }

  if (metadata.uploadCount >= MAX_UPLOADS_PER_THREAD) {
    throw new Error(`Maximum ${MAX_UPLOADS_PER_THREAD} files per thread`);
  }

  if (buffer.length > MAX_UPLOAD_SIZE) {
    throw new Error(`File too large (max ${MAX_UPLOAD_SIZE / 1024 / 1024}MB)`);
  }

  // Sanitize filename
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uploadsDir = getThreadUploadsDir(userId, threadId);
  const filePath = path.join(uploadsDir, safeFilename);

  const { writeFileBuffer } = await import('./storage');
  await writeFileBuffer(filePath, buffer);

  metadata.uploadCount += 1;
  metadata.updatedAt = new Date().toISOString();
  await writeJson(path.join(threadDir, 'metadata.json'), metadata);

  return {
    filename: safeFilename,
    uploadCount: metadata.uploadCount,
  };
}

export async function deleteUpload(userId: string, threadId: string, filename: string): Promise<number> {
  const threadDir = getThreadDir(userId, threadId);
  const metadata = await readJson<ThreadMetadata>(path.join(threadDir, 'metadata.json'));

  if (!metadata || metadata.userId !== userId) {
    throw new Error('Thread not found');
  }

  const uploadsDir = getThreadUploadsDir(userId, threadId);
  const filePath = path.join(uploadsDir, filename);

  await deleteFile(filePath);

  metadata.uploadCount = Math.max(0, metadata.uploadCount - 1);
  metadata.updatedAt = new Date().toISOString();
  await writeJson(path.join(threadDir, 'metadata.json'), metadata);

  return metadata.uploadCount;
}

export async function getUploadPaths(userId: string, threadId: string): Promise<string[]> {
  const uploadsDir = getThreadUploadsDir(userId, threadId);
  const files = await listFiles(uploadsDir);
  return files
    .filter(f => f.endsWith('.pdf'))
    .map(f => path.join(uploadsDir, f));
}
