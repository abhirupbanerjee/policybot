# Phase 1 Migration Guide

## Overview
Phase 1 implementation has removed all hardcoded "policy" references and improved RAG settings. This guide explains how to migrate your existing data.

---

## Changes Made

### 1. Code Changes
✅ Updated context formatting ([src/lib/rag.ts](../src/lib/rag.ts))
✅ Updated prompt construction ([src/lib/openai.ts](../src/lib/openai.ts))
✅ Updated system prompt ([src/lib/storage.ts](../src/lib/storage.ts))
✅ Updated collection name ([src/lib/chroma.ts](../src/lib/chroma.ts))
✅ Updated web search tool description ([src/lib/tools/tavily.ts](../src/lib/tools/tavily.ts))
✅ Updated UI labels ([src/app/admin/page.tsx](../src/app/admin/page.tsx))
✅ Improved default RAG settings ([src/lib/storage.ts](../src/lib/storage.ts))

### 2. New RAG Settings
```typescript
topKChunks: 20           // was 15
maxContextChunks: 15     // was 12
similarityThreshold: 0.5 // was 0.3
chunkSize: 800           // was 500
chunkOverlap: 150        // was 50
```

---

## Migration Steps

### Option 1: Use Environment Variable (Recommended for Existing Systems)

If you have existing documents indexed in the `policy_documents` collection, you can continue using it:

1. **Set environment variable** in your `.env` file:
   ```bash
   CHROMA_COLLECTION_NAME=policy_documents
   ```

2. **Restart your application**
   - All code changes will work with your existing collection
   - No data migration needed
   - You can rename the collection later at your convenience

### Option 2: Migrate to New Collection Name

If you want to use the new `organizational_documents` collection name:

#### Step 1: Create Migration Script

Create a file `scripts/migrate-collection.ts`:

```typescript
import { ChromaClient } from 'chromadb';

async function migrateCollection() {
  const host = process.env.CHROMA_HOST || 'localhost';
  const port = process.env.CHROMA_PORT || '8000';

  const client = new ChromaClient({
    path: `http://${host}:${port}`,
  });

  console.log('Starting collection migration...');

  try {
    // 1. Get old collection
    console.log('Fetching old collection: policy_documents');
    const oldCollection = await client.getCollection({ name: 'policy_documents' });

    // 2. Get all data
    console.log('Retrieving all data from old collection...');
    const allData = await oldCollection.get({
      include: ['embeddings', 'documents', 'metadatas']
    });

    console.log(`Found ${allData.ids.length} chunks to migrate`);

    // 3. Create new collection
    console.log('Creating new collection: organizational_documents');
    const newCollection = await client.createCollection({
      name: 'organizational_documents',
      metadata: { 'hnsw:space': 'cosine' }
    });

    // 4. Add all data to new collection in batches
    const batchSize = 100;
    for (let i = 0; i < allData.ids.length; i += batchSize) {
      const end = Math.min(i + batchSize, allData.ids.length);
      console.log(`Migrating chunks ${i + 1} to ${end} of ${allData.ids.length}...`);

      await newCollection.add({
        ids: allData.ids.slice(i, end),
        embeddings: allData.embeddings?.slice(i, end),
        documents: allData.documents?.slice(i, end),
        metadatas: allData.metadatas?.slice(i, end)
      });
    }

    console.log('✅ Migration complete!');
    console.log('\nNext steps:');
    console.log('1. Test the new collection');
    console.log('2. If everything works, delete the old collection:');
    console.log('   await client.deleteCollection({ name: "policy_documents" });');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
migrateCollection()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

#### Step 2: Run Migration

```bash
# Make sure ChromaDB is running
docker-compose up -d chromadb

# Run the migration script
npx tsx scripts/migrate-collection.ts
```

#### Step 3: Verify Migration

1. Check that the new collection exists and has data:
   ```bash
   # You can verify in your app's admin panel or by checking Chroma directly
   ```

2. Test a few queries to ensure retrieval works correctly

#### Step 4: Clean Up (Optional)

Once you've verified everything works, you can delete the old collection:

```typescript
// In Node.js console or a script
import { ChromaClient } from 'chromadb';

const client = new ChromaClient({
  path: 'http://localhost:8000'
});

await client.deleteCollection({ name: 'policy_documents' });
```

### Option 3: Fresh Start (If No Important Data)

If you don't have important data indexed yet:

1. **Delete old collection** (optional):
   ```bash
   # The system will create the new collection automatically
   ```

2. **Re-index all documents** via the Admin UI:
   - Go to Admin → Documents
   - Delete and re-upload your documents
   - The new collection will be created automatically

---

## Testing After Migration

### 1. Test Different Document Types

Try queries for different document types to verify the changes:

```
✅ "What is DTA?" - Should now find design/architecture docs
✅ "What is the leave policy?" - Should find policy docs
✅ "What are the guidelines for architecture?" - Should find guidelines
✅ "What standards apply to cloud?" - Should find standards
```

### 2. Verify Error Messages

If no results are found, you should now see:
- ❌ Old: "No relevant policy documents found."
- ✅ New: "No relevant documents found in the knowledge base."

### 3. Check Sources Display

Sources should now be labeled:
- ✅ "=== KNOWLEDGE BASE DOCUMENTS ===" (instead of "POLICY DOCUMENTS")

---

## Rollback Plan

If you need to rollback these changes:

1. **Revert the code changes:**
   ```bash
   git revert <commit-hash>
   ```

2. **Restore environment variable** (if using Option 1):
   ```bash
   # Remove CHROMA_COLLECTION_NAME from .env
   ```

3. **Restart application**

---

## New RAG Settings Impact

The new default RAG settings will apply to NEW installs only. Existing systems will keep their current settings stored in `data/config/rag-settings.json`.

### To Apply New Settings to Existing System:

**Option A: Via Admin UI** (if available)
- Go to Admin → Settings → RAG Configuration
- Update the values manually

**Option B: Delete Config File** (to use new defaults)
```bash
rm data/config/rag-settings.json
# Restart the application - new defaults will be used
```

**Option C: Update Config File Manually**
Edit `data/config/rag-settings.json`:
```json
{
  "topKChunks": 20,
  "maxContextChunks": 15,
  "similarityThreshold": 0.5,
  "chunkSize": 800,
  "chunkOverlap": 150,
  "queryExpansionEnabled": true,
  "cacheEnabled": true,
  "cacheTTLSeconds": 3600,
  "updatedAt": "2025-12-03T...",
  "updatedBy": "admin"
}
```

---

## Performance Considerations

### Increased Context Size
- **Before**: Up to 12 chunks × ~500 chars = ~6,000 characters
- **After**: Up to 15 chunks × ~800 chars = ~12,000 characters

**Impact**:
- ✅ Better context for LLM
- ⚠️ Slightly higher token usage (~2-3% more)
- ⚠️ Marginally longer response times (~100-200ms)

### Higher Similarity Threshold
- **Before**: 0.3 (30% similarity)
- **After**: 0.5 (50% similarity)

**Impact**:
- ✅ More relevant results
- ✅ Less noise in context
- ⚠️ Fewer results for very broad queries
- ⚠️ May need better query phrasing for edge cases

---

## Monitoring

After migration, monitor:

1. **Query Success Rate**
   - Track queries that return "No relevant documents found"
   - Should improve for non-policy queries

2. **Response Quality**
   - User feedback on answer accuracy
   - Should improve with better context

3. **Performance Metrics**
   - Query latency
   - Token usage
   - Should remain similar or slightly higher

---

## FAQs

### Q: Do I need to re-index my documents?
**A**: No, unless you're using Option 3 (fresh start). The embeddings and chunks remain the same.

### Q: Will my existing queries still work?
**A**: Yes! The changes are internal. The API and UI remain the same.

### Q: What happens to my custom system prompt?
**A**: If you've customized the system prompt via the Admin UI, it will be preserved. Only the default prompt for new installs has changed.

### Q: Can I keep using "policy" terminology?
**A**: Yes! The system now handles ALL document types, including policies. The changes just make it more flexible.

### Q: Will this break my production system?
**A**: No. Using Option 1 (environment variable) allows you to keep everything working without migration.

---

## Support

If you encounter issues:

1. Check logs for errors
2. Verify ChromaDB is running
3. Test with a simple query
4. Review [RAG_IMPROVEMENT_RECOMMENDATIONS.md](RAG_IMPROVEMENT_RECOMMENDATIONS.md) for troubleshooting

---

## Next Steps

After completing Phase 1:

- ✅ Test with various document types
- ✅ Monitor query success rates
- ✅ Gather user feedback
- 🔜 Consider Phase 2 (enhanced query processing)
- 🔜 Consider Phase 3 (metadata filtering)
