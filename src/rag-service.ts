import { Effect, Console, Data, Array as EffectArray } from 'effect'
import { z } from 'zod'
import OpenAI from 'openai'
import { Document } from './document-processor-simple.js'

// Error types
export class RetrievalError extends Data.TaggedError('RetrievalError')<{
  message: string
  cause?: unknown
}> {}

export class GenerationError extends Data.TaggedError('GenerationError')<{
  message: string
  cause?: unknown
}> {}

// Types
export const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.date(),
  userId: z.string()
})

export type ChatMessage = z.infer<typeof ChatMessageSchema>

export const RetrievalResultSchema = z.object({
  chunk: z.string(),
  document: z.string(),
  similarity: z.number()
})

export type RetrievalResult = z.infer<typeof RetrievalResultSchema>

export interface RAGService {
  readonly retrieveRelevantChunks: (
    query: string,
    userId: string,
    bucket: R2Bucket,
    vectorize: Vectorize,
    ai: Ai,
    limit?: number
  ) => Effect.Effect<RetrievalResult[], RetrievalError>
  
  readonly generateResponse: (
    query: string,
    context: RetrievalResult[],
    chatHistory: ChatMessage[],
    openai: OpenAI
  ) => Effect.Effect<string, GenerationError>
  
  readonly generateQueryEmbedding: (
    query: string,
    ai: Ai
  ) => Effect.Effect<number[], RetrievalError>
  
  readonly storeChatMessage: (
    message: ChatMessage,
    bucket: R2Bucket
  ) => Effect.Effect<void, RetrievalError>
}

export const RAGServiceLive: RAGService = {
  retrieveRelevantChunks: (
    query: string,
    userId: string,
    bucket: R2Bucket,
    vectorize: Vectorize,
    ai: Ai,
    limit = 5
  ) =>
    Effect.gen(function* () {
      yield* Console.log(`Retrieving relevant chunks for query: ${query}`)
      
      // Generate embedding for the query
      const queryEmbedding = yield* RAGServiceLive.generateQueryEmbedding(query, ai)
      
      // Search for similar vectors
      const searchResults = yield* Effect.tryPromise({
        try: () => vectorize.query(queryEmbedding, {
          topK: limit,
          returnValues: true,
          returnMetadata: true,
          filter: { userId }
        }),
        catch: (error) => new RetrievalError({
          message: 'Failed to search vectors',
          cause: error
        })
      })
      
      // Fetch document chunks with similarity scores
      const results = yield* Effect.forEach(
        searchResults.matches,
        (match) => Effect.gen(function* () {
          const metadata = match.metadata as { documentId: string; chunkId: string; content: string }
          
          return {
            chunk: metadata.content,
            document: metadata.documentId,
            similarity: match.score
          }
        }),
        { concurrency: 'unbounded' }
      )
      
      return results
    }),
  
  generateResponse: (
    query: string,
    context: RetrievalResult[],
    chatHistory: ChatMessage[],
    openai: OpenAI
  ) =>
    Effect.gen(function* () {
      yield* Console.log(`Generating response for query: ${query}`)
      
      const contextText = context
        .map(result => `[Document: ${result.document}]\n${result.chunk}`)
        .join('\n\n')
      
      const historyText = chatHistory
        .slice(-10) // Only use last 10 messages
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n')
      
      const systemPrompt = `You are an intelligent assistant that answers questions based on the provided context from uploaded documents. 
      
Rules:
1. Use only the information from the provided context to answer questions
2. If the answer cannot be found in the context, say so clearly
3. Be concise but comprehensive
4. Reference the relevant documents when possible
5. Maintain conversation continuity with the chat history

Context:
${contextText}

Chat History:
${historyText}`
      
      const response = yield* Effect.tryPromise({
        try: () => openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: query }
          ],
          temperature: 0.7,
          max_tokens: 1000
        }),
        catch: (error) => new GenerationError({
          message: 'Failed to generate response',
          cause: error
        })
      })
      
      const content = response.choices[0]?.message?.content
      
      if (!content) {
        return yield* Effect.fail(new GenerationError({
          message: 'No response generated'
        }))
      }
      
      return content
    }),
  
  generateQueryEmbedding: (query: string, ai: Ai) =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: () => ai.run('@cf/baai/bge-base-en-v1.5', {
          text: query
        }),
        catch: (error) => new RetrievalError({
          message: 'Failed to generate query embedding',
          cause: error
        })
      })
      
      return (result as any).data[0]
    }),
  
  storeChatMessage: (message: ChatMessage, bucket: R2Bucket) =>
    Effect.gen(function* () {
      yield* Console.log(`Storing chat message: ${message.id}`)
      
      yield* Effect.tryPromise({
        try: () => bucket.put(
          `chat/${message.userId}/${message.id}.json`,
          JSON.stringify(message),
          {
            httpMetadata: {
              contentType: 'application/json'
            },
            customMetadata: {
              userId: message.userId,
              role: message.role
            }
          }
        ),
        catch: (error) => new RetrievalError({
          message: 'Failed to store chat message',
          cause: error
        })
      })
    })
}

// Helper functions
export const createChatMessage = (
  role: 'user' | 'assistant',
  content: string,
  userId: string
): ChatMessage => ({
  id: crypto.randomUUID(),
  role,
  content,
  timestamp: new Date(),
  userId
})

export const getChatHistory = (
  userId: string,
  bucket: R2Bucket,
  limit = 20
): Effect.Effect<ChatMessage[], RetrievalError> =>
  Effect.gen(function* () {
    const list = yield* Effect.tryPromise({
      try: () => bucket.list({
        prefix: `chat/${userId}/`,
        limit
      }),
      catch: (error) => new RetrievalError({
        message: 'Failed to list chat messages',
        cause: error
      })
    })
    
    const messages = yield* Effect.forEach(
      list.objects,
      (obj) => Effect.gen(function* () {
        const r2Object = yield* Effect.tryPromise({
          try: () => bucket.get(obj.key),
          catch: (error) => new RetrievalError({
            message: 'Failed to get chat message',
            cause: error
          })
        })
        
        if (!r2Object) {
          return yield* Effect.fail(new RetrievalError({
            message: 'Chat message not found'
          }))
        }
        
        const content = yield* Effect.tryPromise({
          try: () => r2Object.text(),
          catch: (error) => new RetrievalError({
            message: 'Failed to read chat message',
            cause: error
          })
        })
        
        return JSON.parse(content) as ChatMessage
      }),
      { concurrency: 'unbounded' }
    )
    
    return messages.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
  })