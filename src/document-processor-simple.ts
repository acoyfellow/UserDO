import { Effect, Console, Data } from 'effect'
import { z } from 'zod'

// Error types
export class DocumentProcessingError extends Data.TaggedError('DocumentProcessingError')<{
  message: string
  cause?: unknown
}> {}

export class EmbeddingError extends Data.TaggedError('EmbeddingError')<{
  message: string
  cause?: unknown
}> {}

// Document types
export const DocumentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  content: z.string(),
  fileType: z.string(),
  uploadedAt: z.date(),
  userId: z.string(),
  chunks: z.array(z.object({
    id: z.string(),
    content: z.string(),
    embedding: z.array(z.number()).optional()
  }))
})

export type Document = z.infer<typeof DocumentSchema>

export interface DocumentService {
  readonly processDocument: (
    file: File,
    userId: string
  ) => Effect.Effect<Document, DocumentProcessingError>
  
  readonly storeDocument: (
    document: Document,
    bucket: R2Bucket
  ) => Effect.Effect<void, DocumentProcessingError>
  
  readonly createEmbeddings: (
    chunks: string[],
    ai: Ai
  ) => Effect.Effect<number[][], EmbeddingError>
  
  readonly chunkText: (
    text: string,
    chunkSize?: number
  ) => Effect.Effect<string[], never>
}

export const DocumentServiceLive: DocumentService = {
  processDocument: (file: File, userId: string) =>
    Effect.gen(function* () {
      yield* Console.log(`Processing document: ${file.name}`)
      
      const content = yield* extractTextFromFile(file)
      const chunks = yield* DocumentServiceLive.chunkText(content)
      
      const document: Document = {
        id: crypto.randomUUID(),
        filename: file.name,
        content,
        fileType: file.type,
        uploadedAt: new Date(),
        userId,
        chunks: chunks.map(chunk => ({
          id: crypto.randomUUID(),
          content: chunk
        }))
      }
      
      return document
    }),
  
  storeDocument: (document: Document, bucket: R2Bucket) =>
    Effect.gen(function* () {
      yield* Console.log(`Storing document: ${document.filename}`)
      
      yield* Effect.tryPromise({
        try: () => bucket.put(
          `documents/${document.userId}/${document.id}.json`,
          JSON.stringify(document),
          {
            httpMetadata: {
              contentType: 'application/json'
            },
            customMetadata: {
              userId: document.userId,
              filename: document.filename
            }
          }
        ),
        catch: (error) => new DocumentProcessingError({
          message: `Failed to store document: ${document.filename}`,
          cause: error
        })
      })
    }),
  
  createEmbeddings: (chunks: string[], ai: Ai) =>
    Effect.gen(function* () {
      yield* Console.log(`Creating embeddings for ${chunks.length} chunks`)
      
      const embeddings = yield* Effect.tryPromise({
        try: async () => {
          const results = await Promise.all(
            chunks.map(chunk => 
              ai.run('@cf/baai/bge-base-en-v1.5', {
                text: chunk
              })
            )
          )
          return results.map((result: any) => result.data[0])
        },
        catch: (error) => new EmbeddingError({
          message: 'Failed to create embeddings',
          cause: error
        })
      })
      
      return embeddings
    }),
  
  chunkText: (text: string, chunkSize = 1000) =>
    Effect.gen(function* () {
      const chunks: string[] = []
      const overlap = 200
      
      for (let i = 0; i < text.length; i += chunkSize - overlap) {
        const chunk = text.slice(i, i + chunkSize)
        if (chunk.trim()) {
          chunks.push(chunk.trim())
        }
      }
      
      return chunks
    })
}

// Helper functions
const extractTextFromFile = (file: File): Effect.Effect<string, DocumentProcessingError> =>
  Effect.gen(function* () {
    const text = yield* Effect.tryPromise({
      try: () => file.text(),
      catch: (error) => new DocumentProcessingError({
        message: 'Failed to read file',
        cause: error
      })
    })
    
    // Support basic text files for now
    if (!file.type.includes('text') && !file.name.endsWith('.txt')) {
      return yield* Effect.fail(new DocumentProcessingError({
        message: `Unsupported file type: ${file.type}. Please use text files (.txt) for now.`
      }))
    }
    
    return text
  })