# 🤖 Smart Document Chatbot - Cloudflare Worker

A powerful end-to-end proof of concept for a document-based chatbot built with Cloudflare Workers, TypeScript, and Effect. This system allows users to upload documents (PDF, DOCX, TXT) and chat with an AI assistant that can answer questions based on the uploaded content using Retrieval-Augmented Generation (RAG).

## ✨ Features

- **Document Upload**: Support for PDF, DOCX, and TXT files
- **Smart Text Processing**: Automatic text extraction and chunking
- **Vector Embeddings**: Uses Cloudflare AI for document embeddings
- **RAG Implementation**: Retrieval-Augmented Generation for contextual responses
- **Real-time Chat**: Interactive chat interface with message history
- **Effect Integration**: Functional programming with comprehensive error handling
- **Modern UI**: Beautiful, responsive frontend with drag-and-drop upload
- **Scalable Architecture**: Built on Cloudflare's edge platform

## 🏗️ Architecture

```
Frontend (HTML/JS) → Cloudflare Worker → Services:
                                      ├─ Document Processor (Effect)
                                      ├─ RAG Service (Effect)
                                      ├─ R2 Storage (Documents)
                                      ├─ Vectorize (Embeddings)
                                      ├─ OpenAI API (Chat)
                                      └─ Cloudflare AI (Embeddings)
```

## 🚀 Setup Instructions

### 1. Prerequisites

- Node.js 18+ and bun
- Cloudflare account with Workers access
- OpenAI API key
- Wrangler CLI installed

### 2. Install Dependencies

```bash
bun install
```

### 3. Configure Cloudflare Resources

You'll need to create these resources in your Cloudflare dashboard:

#### R2 Bucket
```bash
npx wrangler r2 bucket create chatbot-documents
```

#### Vectorize Index
```bash
npx wrangler vectorize create document-embeddings --dimensions=768 --metric=cosine
```

#### D1 Database (Optional for extended features)
```bash
npx wrangler d1 create chatbot-db
```

### 4. Environment Variables

Update your `wrangler.jsonc` with your actual resource IDs:

```json
{
  "vars": {
    "JWT_SECRET": "your-jwt-secret-here",
    "OPENAI_API_KEY": "your-openai-api-key-here"
  },
  "r2_buckets": [
    {
      "binding": "DOCUMENTS",
      "bucket_name": "chatbot-documents"
    }
  ],
  "vectorize": [
    {
      "binding": "VECTORIZE",
      "index_name": "document-embeddings"
    }
  ],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "chatbot-db",
      "database_id": "your-database-id"
    }
  ]
}
```

### 5. Deploy

```bash
bun run deploy
```

## 🎯 Usage

### Document Upload

1. Open the chatbot interface
2. Drag and drop files or click "Choose Files"
3. Supported formats: PDF, DOCX, TXT
4. Files are automatically processed and embedded

### Chatting

1. Type your question in the chat input
2. The system will:
   - Search for relevant document chunks
   - Generate contextual responses using OpenAI
   - Show similarity scores for sources
3. Chat history is automatically saved

### API Endpoints

- `POST /api/documents/upload` - Upload documents
- `POST /api/chat` - Send chat messages
- `GET /api/chat/history/:userId` - Get chat history
- `GET /api/documents/:userId` - List user documents
- `DELETE /api/documents/:userId/:documentId` - Delete document

## 🔧 Technical Implementation

### Document Processing (Effect)

```typescript
// Document processor using Effect for functional error handling
const processDocument = (file: File, userId: string) =>
  Effect.gen(function* () {
    const content = yield* extractTextFromFile(file)
    const chunks = yield* chunkText(content)
    const embeddings = yield* createEmbeddings(chunks)
    // Store in R2 and Vectorize
  })
```

### RAG Service (Effect)

```typescript
// RAG implementation with Effect
const generateResponse = (query: string, context: RetrievalResult[]) =>
  Effect.gen(function* () {
    const relevantChunks = yield* retrieveRelevantChunks(query)
    const response = yield* generateAIResponse(query, relevantChunks)
    return response
  })
```

### Error Handling

The system uses Effect's tagged errors for comprehensive error handling:

- `DocumentProcessingError` - File processing issues
- `EmbeddingError` - Vector embedding failures
- `RetrievalError` - Document retrieval problems
- `GenerationError` - AI response generation issues

## 📊 Performance Considerations

- **Chunking**: Documents are split into 1000-character chunks with 200-character overlap
- **Embedding Model**: Uses `@cf/baai/bge-base-en-v1.5` for fast, accurate embeddings
- **Vector Search**: Optimized similarity search with configurable top-k results
- **Caching**: Cloudflare's edge caching for static assets

## 🔐 Security Features

- User isolation (documents are per-user)
- JWT authentication integration
- Input validation with Zod schemas
- CORS configuration
- Error message sanitization

## 🛠️ Development

### Local Development

```bash
bun run dev
```

### Testing

```bash
bun run check
```

### Build

```bash
bun run build
```

## 📁 File Structure

```
src/
├── main-worker.ts           # Main worker entry point
├── document-processor.ts    # Document processing with Effect
├── rag-service.ts          # RAG implementation with Effect
├── chatbot-routes.ts       # API endpoints
├── worker.tsx              # Original UserDO worker
├── UserDO.ts              # User management
└── database/              # Database utilities

dist/
└── index.html             # Frontend interface
```

## 🚀 Advanced Features

### Custom Embedding Models

You can easily switch to different embedding models:

```typescript
// In document-processor.ts
const embeddings = yield* Effect.tryPromise({
  try: () => ai.run('@cf/your-preferred-model', { text: chunk }),
  catch: (error) => new EmbeddingError({ message: 'Failed to create embeddings' })
})
```

### Multiple AI Providers

Extend the system to use multiple AI providers:

```typescript
// In rag-service.ts
const providers = {
  openai: new OpenAI({ apiKey: env.OPENAI_API_KEY }),
  anthropic: new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
}
```

### Enhanced Document Types

Add support for more document types:

```typescript
// In document-processor.ts
case 'application/vnd.ms-excel':
  return yield* extractExcelText(uint8Array)
case 'text/csv':
  return yield* extractCSVText(uint8Array)
```

## 🐛 Troubleshooting

### Common Issues

1. **Embedding Failures**: Check Cloudflare AI limits and quotas
2. **Vector Search Issues**: Verify Vectorize index configuration
3. **File Upload Errors**: Check R2 bucket permissions
4. **Chat Not Working**: Verify OpenAI API key and quotas

### Debugging

Enable debug logging:

```typescript
// Add to main-worker.ts
console.log('Debug:', { request: request.url, env: Object.keys(env) })
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes with Effect patterns
4. Add tests and documentation
5. Submit a pull request

## 📄 License

MIT License - feel free to use this for your projects!

## 🌟 Future Enhancements

- [ ] Multi-language support
- [ ] Advanced document parsing (tables, images)
- [ ] Real-time collaboration
- [ ] Analytics and usage tracking
- [ ] Custom embedding fine-tuning
- [ ] Integration with more AI providers
- [ ] Advanced RAG techniques (hybrid search, re-ranking)

---

Built with ❤️ using Cloudflare Workers, TypeScript, and Effect.