# Changelog

All notable changes to the Policy Bot project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - 2025-12-03
- **New npm scripts** for improved developer experience:
  - `npm run type-check` - TypeScript type checking without build
  - `npm run test:connectivity` - Test API connectivity to external services
  - `npm run docker:dev` - Start development services
  - `npm run docker:dev:down` - Stop development services
  - `npm run docker:prod` - Build and start production stack
  - `npm run docker:prod:down` - Stop production stack
  - `npm run docker:logs` - View application logs
- **Documentation improvements**:
  - Added [docs/README.md](docs/README.md) for centralized documentation index
  - Added Scripts & Commands section to main README
  - Improved documentation organization and navigation

### Changed - 2025-12-03
- **Documentation reorganization**:
  - Moved historical implementation docs to `docs/archive/`
  - Consolidated core documentation in main `docs/` directory
  - Updated README with better structure and quick links
- **Removed terminology bias**: All "policy" references changed to "knowledge base" for document-type agnostic operation

### Removed - 2025-12-03
- **Cleanup**:
  - Removed `test-formatting.js` (one-time test script)
  - Removed `MARKDOWN_TEST.md` (test document)
  - Archived outdated implementation documentation

### Fixed - 2025-12-03
- Improved RAG settings for better document retrieval across all document types

## Previous Changes

### Phase 1 Implementation (2025-12-03)
- Removed hardcoded "policy" references throughout codebase
- Updated RAG settings with improved defaults
- Enhanced system prompt for better formatting
- Added web search integration via Tavily
- Improved UI with better markdown rendering

### Initial Release (2024-12)
- RAG-based chatbot with ChromaDB vector search
- OpenAI GPT integration with multiple model support
- Redis caching for improved performance
- Multi-provider authentication (Azure AD, Google OAuth)
- Admin panel for document and user management
- Docker-based deployment with Traefik reverse proxy
- User document upload and compliance checking
- Voice input via OpenAI Whisper
