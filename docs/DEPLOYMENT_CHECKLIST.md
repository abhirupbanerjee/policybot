# Phase 1 Deployment Checklist

## Pre-Deployment

### 1. Backup Current System
- [ ] Backup ChromaDB data directory
  ```bash
  cp -r ./chroma-data ./chroma-data.backup
  ```
- [ ] Backup configuration files
  ```bash
  cp -r ./data ./data.backup
  ```
- [ ] Note current environment variables
  ```bash
  cat .env > .env.backup
  ```

### 2. Review Changes
- [ ] Read [PHASE1_IMPLEMENTATION_SUMMARY.md](PHASE1_IMPLEMENTATION_SUMMARY.md)
- [ ] Read [PHASE1_MIGRATION_GUIDE.md](PHASE1_MIGRATION_GUIDE.md)
- [ ] Understand the changes made
- [ ] Decide on migration approach (Option 1, 2, or 3)

### 3. Build Verification
- [ ] Build completed successfully ✅ (already done)
- [ ] No TypeScript errors
- [ ] No linting warnings

---

## Deployment Steps

### Option 1: Backward Compatible (Recommended for existing systems)

**Fastest path - No downtime, no migration**

- [ ] Add to `.env` file:
  ```bash
  CHROMA_COLLECTION_NAME=policy_documents
  ```
- [ ] Deploy code changes
  ```bash
  git pull origin main
  docker-compose restart policy-bot
  # OR
  npm run build && pm2 restart policy-bot
  ```
- [ ] Verify application starts successfully
- [ ] Test with a simple query

**Estimated Time: 5 minutes**

---

### Option 2: Migrate Collection Name

**If you want to use the new collection name**

- [ ] Ensure ChromaDB is running
  ```bash
  docker-compose up -d chromadb
  ```
- [ ] Create migration script (see [PHASE1_MIGRATION_GUIDE.md](PHASE1_MIGRATION_GUIDE.md))
- [ ] Run migration script
  ```bash
  npx tsx scripts/migrate-collection.ts
  ```
- [ ] Verify migration completed successfully
- [ ] Test queries with new collection
- [ ] Deploy application (no .env change needed)
- [ ] Delete old collection (optional)

**Estimated Time: 15-30 minutes**

---

### Option 3: Fresh Start

**Only if you don't have important data**

- [ ] Delete old collection (optional)
- [ ] Deploy code changes
- [ ] Re-upload documents via Admin UI
- [ ] Verify all documents indexed

**Estimated Time: 30-60 minutes (depending on doc count)**

---

## Post-Deployment Testing

### Critical Tests

- [ ] **Application Health**
  - [ ] Application starts without errors
  - [ ] Login works
  - [ ] Admin panel accessible
  - [ ] No console errors

- [ ] **DTA Query Test** (Your original issue)
  ```
  Query: "What is DTA?"
  Expected: Should retrieve DTA design/architecture documents
  ```
  - [ ] Test passed ✅

- [ ] **Policy Query Test**
  ```
  Query: "What is the leave policy?"
  Expected: Should retrieve policy documents
  ```
  - [ ] Test passed ✅

- [ ] **No Results Test**
  ```
  Query: "asdfghjkl random gibberish"
  Expected: "No relevant documents found in the knowledge base."
  ```
  - [ ] Correct error message displayed ✅

- [ ] **Web Search Test** (if Tavily enabled)
  ```
  Query: "What's the current weather?"
  Expected: Uses web search tool
  ```
  - [ ] Test passed ✅

### UI Verification

- [ ] Admin → Documents page
  - [ ] Header shows "Knowledge Base Documents" ✅
  - [ ] Document list displays correctly
  - [ ] Upload works
  - [ ] Delete works
  - [ ] Reindex works

- [ ] Chat Interface
  - [ ] New thread creation works
  - [ ] Messages send successfully
  - [ ] Sources display correctly
  - [ ] File upload works
  - [ ] Voice input works (if enabled)

### Performance Checks

- [ ] Response times acceptable (<5 seconds)
- [ ] No memory leaks
- [ ] ChromaDB responding normally
- [ ] Redis cache working (check logs)

---

## Monitoring

### First 24 Hours

Monitor these metrics:

- [ ] **Error Rate**
  - Check logs for errors
  - Target: No increase in error rate

- [ ] **Query Success Rate**
  - Track "No relevant documents found" occurrences
  - Target: Should decrease for non-policy queries

- [ ] **Response Times**
  - Check average query latency
  - Expected: ~100-200ms increase (acceptable)

- [ ] **User Feedback**
  - Ask users about answer quality
  - Target: Positive feedback on DTA-type queries

### First Week

- [ ] Review query logs
  - Identify any new failure patterns
  - Check which documents are being retrieved

- [ ] Review user feedback
  - Are answers better quality?
  - Any new issues reported?

- [ ] Performance trends
  - Response times stable?
  - Token usage within expected range?

---

## Rollback Plan

If critical issues occur:

### Quick Rollback (5 minutes)

```bash
# Stop application
docker-compose stop policy-bot

# Revert code
git revert HEAD
# OR
git checkout <previous-commit>

# Remove new env var (if added)
sed -i '/CHROMA_COLLECTION_NAME/d' .env

# Restart
docker-compose up -d policy-bot
```

### Data Rollback (if needed)

```bash
# Stop services
docker-compose down

# Restore data
rm -rf ./chroma-data
mv ./chroma-data.backup ./chroma-data

rm -rf ./data
mv ./data.backup ./data

# Restore env
cp .env.backup .env

# Restart
docker-compose up -d
```

---

## Configuration Updates

### RAG Settings (Optional)

If you want to apply new RAG settings to your existing system:

**Option A: Via config file**
```bash
# Edit data/config/rag-settings.json
nano data/config/rag-settings.json
```

Update values:
```json
{
  "topKChunks": 20,
  "maxContextChunks": 15,
  "similarityThreshold": 0.5,
  "chunkSize": 800,
  "chunkOverlap": 150,
  ...
}
```

**Option B: Delete and use new defaults**
```bash
rm data/config/rag-settings.json
docker-compose restart policy-bot
```

**Note:** If you change `chunkSize` or `chunkOverlap`, you should re-index all documents for consistency.

---

## Success Criteria

Consider deployment successful when:

- [ ] ✅ Application running without errors
- [ ] ✅ All critical tests passed
- [ ] ✅ DTA query works correctly (main issue fixed)
- [ ] ✅ Policy queries still work
- [ ] ✅ No degradation in performance
- [ ] ✅ User feedback positive
- [ ] ✅ No increase in error rate

---

## Common Issues & Solutions

### Issue: "Collection not found" error
**Solution:**
```bash
# Make sure CHROMA_COLLECTION_NAME is set if using Option 1
echo "CHROMA_COLLECTION_NAME=policy_documents" >> .env
docker-compose restart policy-bot
```

### Issue: Query results seem worse
**Solution:**
1. Check if similarity threshold is too high
2. Try lowering to 0.4 temporarily
3. Review retrieved chunks in logs

### Issue: Response times increased significantly
**Solution:**
1. Check ChromaDB performance
2. Verify Redis is working
3. Consider reducing `maxContextChunks` from 15 to 12

### Issue: "No relevant documents" for queries that should work
**Solution:**
1. Verify documents are indexed (check Admin panel)
2. Check similarity threshold (may be too high)
3. Test with broader query terms
4. Check if query expansion is enabled

---

## Documentation Updates

After successful deployment, update:

- [ ] Internal wiki/docs with new terminology
- [ ] User guides (if any mention "policy documents")
- [ ] Training materials
- [ ] API documentation (if applicable)

---

## Communication

### Notify Stakeholders

- [ ] Inform users of the improvement
- [ ] Highlight that DTA-type queries now work
- [ ] Ask for feedback on answer quality

### Sample Announcement

```
📢 System Update: Enhanced Document Search

We've improved the document search system to better handle all
types of organizational documents, not just policies!

What's new:
✅ Better retrieval of design docs, guidelines, and standards
✅ More accurate answers with improved context
✅ Fixed issue with DTA and similar queries

Please let us know if you notice any issues or improvements!
```

---

## Next Steps After Deployment

### Short Term (1-2 weeks)
- [ ] Gather user feedback
- [ ] Monitor performance metrics
- [ ] Fine-tune RAG settings if needed
- [ ] Document any issues and resolutions

### Medium Term (1-2 months)
- [ ] Consider Phase 2 implementation (enhanced query processing)
- [ ] Analyze query patterns
- [ ] Identify documents that are never retrieved
- [ ] Plan metadata strategy

### Long Term (3-6 months)
- [ ] Consider Phase 3 implementation (metadata filtering)
- [ ] Develop search analytics dashboard
- [ ] Implement document auto-classification
- [ ] Review and optimize based on usage data

---

## Sign-Off

- [ ] **Technical Lead:** Code reviewed and approved
- [ ] **QA:** Testing completed and passed
- [ ] **DevOps:** Deployment plan reviewed
- [ ] **Product Owner:** User impact understood

**Deployed By:** _________________

**Date:** _________________

**Environment:** _________________

**Notes:** _________________________________
