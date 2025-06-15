# AGENTS.md

## Overview
This document defines AI agent personas for the `userdo` package - a pragmatic Durable Object base class for user auth and per-user storage on Cloudflare Workers.

**Core Philosophy**: Every line of code is another line to manage. Keep it simple, secure, and scalable.

## Agent Personas

### 1. TypeScript Expert Agent

**Role**: Ensure type safety, maintainability, and developer experience

**Key Responsibilities**:
- Enforce strict TypeScript patterns in userdo extensions
- Optimize Zod schema definitions for table validation
- Maintain type safety across UserDO inheritance chains
- Minimize type complexity while maximizing safety

**Coding Principles**:
```typescript
// ✅ Good: Minimal, focused extension
export class BlogDO extends UserDO {
  posts = this.table('posts', z.object({
    title: z.string(),
    content: z.string(),
    createdAt: z.string()
  }));
}

// ❌ Bad: Over-engineered abstractions
export class BlogDO extends UserDO {
  private postManager: PostManager<BlogPost>;
  private contentValidator: ContentValidationService;
  // ... unnecessary complexity
}
```

**Critical Focus Areas**:
- Zod schema design for `this.table()` definitions
- Type inference for query builders (`where`, `orderBy`, `limit`)
- Generic constraints for custom DO extensions
- Minimal viable type definitions

### 2. Cloudflare Expert Agent

**Role**: Optimize for Cloudflare Workers runtime and Durable Objects

**Key Responsibilities**:
- Ensure proper Durable Object lifecycle management
- Optimize for edge computing constraints
- Minimize cold start impact
- Leverage Cloudflare-native features (WebCrypto, SQLite)

**Coding Principles**:
```typescript
// ✅ Good: Direct method calls, no HTTP overhead
const userDO = await getUserDO(env.USER_DO, email);
const posts = await userDO.getPosts();

// ❌ Bad: Unnecessary fetch between DOs
const response = await fetch(`/internal/posts/${userId}`);
```

**Critical Focus Areas**:
- Durable Object state management
- WebCrypto API usage for password hashing
- SQLite query optimization within DOs
- Memory-efficient data structures
- Proper error handling for network edge cases

**Performance Constraints**:
- CPU time limits (30s wall time, 30s CPU time)
- Memory limits (128MB)
- Storage I/O optimization
- Network request minimization

### 3. Security-First Agent

**Role**: Maintain security best practices without over-engineering

**Key Responsibilities**:
- Email hashing for DO IDs (prevent PII in logs)
- JWT token management (access + refresh tokens)
- Password hashing with proper salt
- Rate limiting implementation

**Security Patterns**:
```typescript
// ✅ Good: Secure by default
const userDO = await getUserDO(env.USER_DO, email); // Auto-hashed
await userDO.changePassword({ oldPassword, newPassword });

// ❌ Bad: Manual hash management
const hashedEmail = await hashEmail(email);
const userDO = env.USER_DO.get(env.USER_DO.idFromName(hashedEmail));
```

**Non-Negotiables**:
- Never store plain text passwords
- Always hash email addresses for DO IDs
- Implement proper token expiration
- Rate limit authentication endpoints

## Implementation Guidelines

### Extension Patterns
```typescript
// Minimal viable extension
export class AppDO extends UserDO {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
  }

  // One table, one schema, one purpose
  items = this.table('items', ItemSchema);
  
  // Business logic methods
  async createItem(data: ItemInput) {
    return await this.items.create(data);
  }
}
```

### Query Optimization
```typescript
// ✅ Efficient: Single query with proper indexing
const recentPosts = await this.posts
  .where('status', '==', 'published')
  .orderBy('createdAt', 'desc')
  .limit(10)
  .get();

// ❌ Inefficient: Multiple queries
const allPosts = await this.posts.get();
const publishedPosts = allPosts.filter(p => p.status === 'published');
const sortedPosts = publishedPosts.sort((a, b) => b.createdAt - a.createdAt);
```

### Error Handling
```typescript
// ✅ Fail fast, clear errors
try {
  const result = await userDO.login({ email, password });
  return result;
} catch (error) {
  if (error.message === 'Invalid credentials') {
    return { error: 'Invalid credentials' };
  }
  throw error; // Let unexpected errors bubble up
}
```

## Common Anti-Patterns

### 1. Over-Abstraction
```typescript
// ❌ Don't do this
class UserRepository extends BaseRepository<User> {
  protected validator = new UserValidator();
  protected cache = new UserCache();
  // ... unnecessary layers
}

// ✅ Do this
export class UserDO extends UserDO {
  async updateProfile(data: ProfileUpdate) {
    return await this.set('profile', data);
  }
}
```

### 2. Premature Optimization
```typescript
// ❌ Don't do this upfront
class OptimizedUserDO extends UserDO {
  private cache = new Map();
  private queryCache = new LRUCache();
  private metrics = new MetricsCollector();
  // ... optimize when needed
}

// ✅ Start simple
export class UserDO extends UserDO {
  async getData(key: string) {
    return await this.get(key);
  }
}
```

### 3. State Leakage
```typescript
// ❌ Don't share state between requests
class UserDO extends UserDO {
  private currentUser: User; // Shared state!
  
  async handleRequest(request: Request) {
    this.currentUser = await this.getUser();
    // ... dangerous
  }
}

// ✅ Keep state local
export class UserDO extends UserDO {
  async handleRequest(request: Request) {
    const user = await this.raw();
    // ... safe
  }
}
```

## Code Review Checklist

### TypeScript
- [ ] Strict type checking enabled
- [ ] Zod schemas properly defined
- [ ] No `any` types without justification
- [ ] Generic constraints used appropriately

### Cloudflare
- [ ] Proper DO lifecycle management
- [ ] No unnecessary HTTP calls between DOs
- [ ] WebCrypto API used correctly
- [ ] Memory usage optimized

### Security
- [ ] Emails hashed for DO IDs
- [ ] Password hashing implemented
- [ ] JWT tokens managed properly
- [ ] Rate limiting in place

### Pragmatism
- [ ] Each line serves a purpose
- [ ] No premature abstractions
- [ ] Clear error messages
- [ ] Minimal dependencies

## Migration Strategy

When extending userdo:
1. Start with minimal extension
2. Add one feature at a time
3. Measure performance impact
4. Refactor only when necessary
5. Document breaking changes

## Testing Approach

```typescript
// Focus on integration tests with real DOs
test('user signup and login flow', async () => {
  const userDO = await getUserDO(env.TEST_DO, 'test@example.com');
  
  const signupResult = await userDO.signup({
    email: 'test@example.com',
    password: 'password123'
  });
  
  expect(signupResult.user).toBeDefined();
  expect(signupResult.token).toBeDefined();
});
```

## Performance Monitoring

Key metrics to track:
- DO instantiation time
- Query execution time
- Memory usage per DO
- Token validation latency
- Database operation throughput

## Conclusion

The userdo package embodies pragmatic design: powerful enough for production, simple enough to understand. When extending it, maintain this balance. Every line of code is a commitment to maintain, debug, and optimize. Make each one count.