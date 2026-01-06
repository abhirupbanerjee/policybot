#!/usr/bin/env npx tsx

/**
 * Cleanup Orphaned ChromaDB Collections
 *
 * This script identifies and deletes ChromaDB collections that no longer
 * have a corresponding category in the database.
 *
 * Usage (inside Docker):
 *   docker exec -it policy-bot-app npx tsx scripts/cleanup-orphaned-collections.ts --dry-run
 *   docker exec -it policy-bot-app npx tsx scripts/cleanup-orphaned-collections.ts
 *
 * Usage (local dev with ChromaDB running):
 *   npx tsx scripts/cleanup-orphaned-collections.ts [--dry-run]
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import Database from 'better-sqlite3';
import { ChromaClient } from 'chromadb';

// Load .env.local manually
function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env.local');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          process.env[key.trim()] = valueParts.join('=').trim();
        }
      }
    }
  } catch {
    console.log('Note: Could not load .env.local');
  }
}

loadEnv();

const CATEGORY_PREFIX = 'category_';
const dryRun = process.argv.includes('--dry-run');

async function main() {
  console.log('='.repeat(60));
  console.log('ChromaDB Orphaned Collection Cleanup');
  console.log('='.repeat(60));

  if (dryRun) {
    console.log('\n🔍 DRY RUN MODE - No collections will be deleted\n');
  }

  // Connect to ChromaDB
  const host = process.env.CHROMA_HOST || 'localhost';
  const port = process.env.CHROMA_PORT || '8000';
  const chromaClient = new ChromaClient({
    path: `http://${host}:${port}`,
  });

  console.log(`Connecting to ChromaDB at http://${host}:${port}...`);

  // Get all collections from ChromaDB
  let collections: string[];
  try {
    collections = (await chromaClient.listCollections()) as string[];
    console.log(`Found ${collections.length} total collections in ChromaDB\n`);
  } catch (error) {
    console.error('Failed to connect to ChromaDB:', error);
    process.exit(1);
  }

  // Filter to only category collections
  const categoryCollections = collections.filter((name) =>
    name.startsWith(CATEGORY_PREFIX)
  );
  console.log(`Found ${categoryCollections.length} category collections`);

  // Connect to SQLite and get all category slugs
  // In Docker: DATA_DIR=/app/data, database is at /app/data/policy-bot.db
  const dataDir = process.env.DATA_DIR || './data';
  const dbPath = process.env.SQLITE_DB_PATH || `${dataDir}/policy-bot.db`;
  let db: Database.Database;
  try {
    db = new Database(dbPath, { readonly: true });
    console.log(`Connected to SQLite at ${dbPath}\n`);
  } catch (error) {
    console.error('Failed to connect to SQLite:', error);
    process.exit(1);
  }

  const categorySlugs = new Set(
    (db.prepare('SELECT slug FROM categories').all() as { slug: string }[]).map(
      (row) => row.slug
    )
  );
  console.log(`Found ${categorySlugs.size} categories in database\n`);

  // Find orphaned collections
  const orphanedCollections: string[] = [];

  for (const collectionName of categoryCollections) {
    const slug = collectionName.replace(CATEGORY_PREFIX, '');
    if (!categorySlugs.has(slug)) {
      orphanedCollections.push(collectionName);
    }
  }

  if (orphanedCollections.length === 0) {
    console.log('✅ No orphaned collections found!\n');
    db.close();
    return;
  }

  console.log(`Found ${orphanedCollections.length} orphaned collection(s):\n`);

  // Display orphaned collections
  for (const collectionName of orphanedCollections) {
    console.log(`  - ${collectionName}`);
  }

  console.log('');

  // Delete orphaned collections
  if (!dryRun) {
    console.log('Deleting orphaned collections...\n');

    let deleted = 0;
    let failed = 0;

    for (const collectionName of orphanedCollections) {
      try {
        await chromaClient.deleteCollection({ name: collectionName });
        console.log(`  ✓ Deleted: ${collectionName}`);
        deleted++;
      } catch (error) {
        console.error(`  ✗ Failed to delete ${collectionName}:`, error);
        failed++;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Summary: ${deleted} deleted, ${failed} failed`);
  } else {
    console.log('Run without --dry-run to delete these collections.');
  }

  db.close();
  console.log('='.repeat(60));
}

main().catch(console.error);
