import { Hono } from 'hono'
import { Effect } from 'effect'
import OpenAI from 'openai'
import { z } from 'zod'
import { DocumentServiceLive, DocumentProcessingError } from './document-processor-simple.js'
import { 
  RAGServiceLive, 
  createChatMessage, 
  getChatHistory, 
  RetrievalError, 
  GenerationError 
} from './rag-service.js'
import { type Env } from './UserDO.js'

// Request schemas
const ChatRequestSchema = z.object({
  message: z.string().min(1),
  userId: z.string()
})

const DocumentUploadSchema = z.object({
  userId: z.string()
})

export function createChatbotRoutes(env: Env) {
  const app = new Hono()
  
  // Initialize OpenAI
  const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY || 'your-openai-api-key'
  })

  // Upload document endpoint
  app.post('/api/documents/upload', async (c) => {
    try {
      const formData = await c.req.formData()
      const file = formData.get('file') as File
      const userId = formData.get('userId') as string
      
      if (!file || !userId) {
        return c.json({ error: 'File and userId are required' }, 400)
      }
      
      // Process document
      const processResult = await Effect.runPromise(
        DocumentServiceLive.processDocument(file, userId)
      )
      
      // Store document in R2
      await Effect.runPromise(
        DocumentServiceLive.storeDocument(processResult, env.DOCUMENTS)
      )
      
      // Generate embeddings
      const chunks = processResult.chunks.map((chunk: any) => chunk.content)
      const embeddings = await Effect.runPromise(
        DocumentServiceLive.createEmbeddings(chunks, env.AI)
      )
      
      // Store embeddings in Vectorize
      const vectors = processResult.chunks.map((chunk: any, index: number) => ({
        id: chunk.id,
        values: (embeddings as number[][])[index],
        metadata: {
          documentId: processResult.id,
          chunkId: chunk.id,
          content: chunk.content,
          userId: userId
        }
      }))
      
      await env.VECTORIZE.upsert(vectors)
      
      return c.json({
        success: true,
        document: {
          id: processResult.id,
          filename: processResult.filename,
          chunksCount: processResult.chunks.length
        }
      })
    } catch (error) {
      console.error('Document upload error:', error)
      return c.json({ 
        error: 'Failed to process document',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500)
    }
  })

  // Chat endpoint
  app.post('/api/chat', async (c) => {
    try {
      const body = await c.req.json()
      const { message, userId } = ChatRequestSchema.parse(body)
      
      // Get chat history
      const chatHistory = await Effect.runPromise(
        getChatHistory(userId, env.DOCUMENTS)
      )
      
      // Retrieve relevant chunks
      const relevantChunks = await Effect.runPromise(
        RAGServiceLive.retrieveRelevantChunks(
          message,
          userId,
          env.DOCUMENTS,
          env.VECTORIZE,
          env.AI
        )
      )
      
      // Generate response
      const response = await Effect.runPromise(
        RAGServiceLive.generateResponse(
          message,
          relevantChunks,
          chatHistory,
          openai
        )
      )
      
      // Store user message
      const userMessage = createChatMessage('user', message, userId)
      await Effect.runPromise(
        RAGServiceLive.storeChatMessage(userMessage, env.DOCUMENTS)
      )
      
      // Store assistant response
      const assistantMessage = createChatMessage('assistant', response, userId)
      await Effect.runPromise(
        RAGServiceLive.storeChatMessage(assistantMessage, env.DOCUMENTS)
      )
      
      return c.json({
        message: response,
        sources: relevantChunks.map(chunk => ({
          document: chunk.document,
          similarity: chunk.similarity
        }))
      })
    } catch (error) {
      console.error('Chat error:', error)
      return c.json({ 
        error: 'Failed to process chat message',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500)
    }
  })

  // Get chat history endpoint
  app.get('/api/chat/history/:userId', async (c) => {
    try {
      const userId = c.req.param('userId')
      
      if (!userId) {
        return c.json({ error: 'User ID is required' }, 400)
      }
      
      const history = await Effect.runPromise(
        getChatHistory(userId, env.DOCUMENTS)
      )
      
      return c.json({ history })
    } catch (error) {
      console.error('Chat history error:', error)
      return c.json({ 
        error: 'Failed to get chat history',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500)
    }
  })

  // Get user documents endpoint
  app.get('/api/documents/:userId', async (c) => {
    try {
      const userId = c.req.param('userId')
      
      if (!userId) {
        return c.json({ error: 'User ID is required' }, 400)
      }
      
      const list = await env.DOCUMENTS.list({
        prefix: `documents/${userId}/`,
        limit: 100
      })
      
      const documents = await Promise.all(
        list.objects.map(async (obj) => {
          const document = await env.DOCUMENTS.get(obj.key)
          if (document) {
            const content = await document.text()
            const parsed = JSON.parse(content)
            return {
              id: parsed.id,
              filename: parsed.filename,
              fileType: parsed.fileType,
              uploadedAt: parsed.uploadedAt,
              chunksCount: parsed.chunks.length
            }
          }
          return null
        })
      )
      
      return c.json({ 
        documents: documents.filter(Boolean) 
      })
    } catch (error) {
      console.error('Documents list error:', error)
      return c.json({ 
        error: 'Failed to get documents',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500)
    }
  })

  // Delete document endpoint
  app.delete('/api/documents/:userId/:documentId', async (c) => {
    try {
      const userId = c.req.param('userId')
      const documentId = c.req.param('documentId')
      
      if (!userId || !documentId) {
        return c.json({ error: 'User ID and Document ID are required' }, 400)
      }
      
      // Delete from R2
      await env.DOCUMENTS.delete(`documents/${userId}/${documentId}.json`)
      
      // Note: In a production system, you'd also want to remove vectors from Vectorize
      // This would require keeping track of chunk IDs or implementing a cleanup process
      
      return c.json({ success: true })
    } catch (error) {
      console.error('Document deletion error:', error)
      return c.json({ 
        error: 'Failed to delete document',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500)
    }
  })

  return app
}