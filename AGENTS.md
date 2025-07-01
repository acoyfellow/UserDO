# AGENTS.md

## Overview
This document defines AI agent personas for the `userdo` package - a pragmatic Durable Object base class for building applications on Cloudflare Workers.

### What UserDO Provides
- Authentication: Email based (JWT) auth with signup, login, password reset
- Key-Value Storage: Per-user KV storage with automatic broadcasting
- Database: Type-safe SQLite tables with Zod schemas and query builder
- Web Server: Pre-built Hono server with all endpoints configured
- Real-time: WebSocket connections with hibernation API support
- Organizations: Multi-user teams with roles and member management

## Philosophy: Simple > Clever

UserDO follows pragmatic coding principles:

- Working simple code > theoretically "better" complex code
- Every line is a liability - more code = more bugs
- Don't fix what isn't broken - if it works reliably, resist refactoring
- Ship then polish - working imperfect code > perfect unshipped code

**Core Philosophy**: Every line of code is another line to manage. Keep it simple, secure, and scalable.

## Agent Personas

### 1. TypeScript Expert Agent

**Role**: Ensure type safety, maintainability, and developer experience

**Key Responsibilities**:
- Enforce strict TypeScript patterns in userdo extensions
- Optimize Zod schema definitions for table validation
- Maintain type safety across UserDO inheritance chains
- Minimize type complexity while maximizing safety
- Ensure proper typing for organization-scoped and user-scoped data

**Coding Principles**:
```typescript
// ✅ Good: Minimal, focused extension with proper scoping
export class TeamDO extends UserDO {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
  }

  // User-scoped data (private to each user)
  posts = this.table('posts', z.object({
    title: z.string(),
    content: z.string(),
    createdAt: z.string()
  }), { userScoped: true });

  // Organization-scoped data (shared within teams)
  projects = this.table('projects', z.object({
    name: z.string(),
    description: z.string(),
    status: z.enum(['active', 'completed'])
  }), { organizationScoped: true });
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
- Proper typing for table scoping options (`userScoped`, `organizationScoped`)
- WebSocket event typing for real-time features
- Organization member role typing
- Minimal viable type definitions

### 2. Cloudflare Expert Agent

**Role**: Optimize for Cloudflare Workers runtime and Durable Objects

**Key Responsibilities**:
- Ensure proper Durable Object lifecycle management
- Optimize for edge computing constraints
- Minimize cold start impact
- Leverage Cloudflare-native features (WebCrypto, SQLite, WebSocket hibernation)
- Implement efficient real-time broadcasting
- Optimize built-in web server performance

**Coding Principles**:
```typescript
// ✅ Good: Direct method calls, no HTTP overhead
const userDO = await getUserDO(env.USER_DO, email);
const posts = await userDO.getPosts();

// ✅ Good: Proper WebSocket hibernation usage
export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    if (request.headers.get('upgrade') === 'websocket') {
      return wsHandler.fetch(request, env, ctx);
    }
    return app.fetch(request, env, ctx);
  }
};

// ❌ Bad: Unnecessary fetch between DOs
const response = await fetch(`/internal/posts/${userId}`);
```

**Critical Focus Areas**:
- Durable Object state management
- WebCrypto API usage for password hashing
- SQLite query optimization within DOs
- WebSocket hibernation API implementation
- Real-time event broadcasting efficiency
- Built-in Hono server optimization
- Organization context switching performance
- Memory-efficient data structures
- Proper error handling for network edge cases

**Performance Constraints**:
- CPU time limits (30s wall time, 30s CPU time)
- Memory limits (128MB)
- Storage I/O optimization
- Network request minimization
- WebSocket connection limits
- Real-time event batching

### 3. Security-First Agent

**Role**: Maintain security best practices without over-engineering

**Key Responsibilities**:
- Email hashing for DO IDs (prevent PII in logs)
- JWT token management (access + refresh tokens)
- Password hashing with proper salt
- Rate limiting implementation
- Organization-based access control
- Cross-user invitation security

**Security Patterns**:
```typescript
// ✅ Good: Secure by default with organization access control
const userDO = await getUserDO(env.USER_DO, email); // Auto-hashed
await userDO.changePassword({ oldPassword, newPassword });

// ✅ Good: Built-in organization access control
async createProject(name: string, organizationId: string) {
  await this.getOrganization(organizationId); // Validates user access
  this.setOrganizationContext(organizationId); // Switch data scope
  return await this.projects.create({ name }); // Auto-scoped to org
}

// ✅ Good: Secure cross-user invitations
await teamDO.addOrganizationMember(orgId, 'user@example.com', 'admin');
// Automatically stores invitation in target user's DO

// ❌ Bad: Manual hash management
const hashedEmail = await hashEmail(email);
const userDO = env.USER_DO.get(env.USER_DO.idFromName(hashedEmail));
```

**Non-Negotiables**:
- Never store plain text passwords
- Always hash email addresses for DO IDs
- Implement proper token expiration
- Rate limit authentication endpoints
- Validate organization membership before data access
- Use built-in access control methods (`getOrganization`, `setOrganizationContext`)
- Secure WebSocket authentication

## Decision Framework

Before adding complexity, ask:

1. **Is there a measurable problem?** (Not theoretical - must affect users, performance, or business metrics)
2. **Is the current solution causing actual pain?** (Check error rates, support tickets, performance metrics)
3. **What's the cost/benefit?** (Time investment vs expected improvement)

### Red Flags (Don't Proceed If):
- Refactoring for hypothetical benefits
- Adding patterns/layers without clear current needs
- Replacing working code with more complex solutions
- "The framework docs recommend..." (without context)

### Valid Reasons to Change Existing Code:
✅ **Objective Issues:**
- Reproducible bugs affecting users
- Measured performance bottlenecks
- Security vulnerabilities

✅ **Business Needs:**
- Blocking required features
- Causing operational costs (time/money)
- Preventing scaling to known requirements

## Implementation Guidelines

### Extension Patterns
```typescript
// Minimal viable extension with organization support
export class AppDO extends UserDO {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
  }

  // User-scoped data (private to each user)
  items = this.table('items', ItemSchema, { userScoped: true });
  
  // Organization-scoped data (shared within teams)
  projects = this.table('projects', ProjectSchema, { organizationScoped: true });
  
  // Business logic methods
  async createItem(data: ItemInput) {
    return await this.items.create(data);
  }

  async createProject(data: ProjectInput, organizationId: string) {
    await this.getOrganization(organizationId); // Built-in access control
    this.setOrganizationContext(organizationId); // Switch data scope
    return await this.projects.create(data); // Auto-scoped to org
  }
}
```

### Built-in Features (Use Instead of Implementing)
```typescript
// ✅ Use built-in authentication endpoints
// POST /api/signup, POST /api/login, GET /api/me

// ✅ Use built-in organization management
// POST /api/organizations, GET /api/organizations/:id
// POST /api/organizations/:id/members

// ✅ Use built-in real-time features
client.onChange('preferences', data => console.log('Updated:', data));

// ✅ Use built-in web server
const app = createUserDOWorker('APP_DO');
const wsHandler = createWebSocketHandler('APP_DO');
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
- [ ] Zod schemas properly defined for all tables
- [ ] No `any` types without justification
- [ ] Generic constraints used appropriately
- [ ] Table scoping options correctly typed (`userScoped`, `organizationScoped`)

### Cloudflare
- [ ] Proper DO lifecycle management
- [ ] No unnecessary HTTP calls between DOs
- [ ] WebCrypto API used correctly
- [ ] WebSocket hibernation API implemented properly
- [ ] Memory usage optimized
- [ ] Built-in web server used instead of custom routing

### Security
- [ ] Emails hashed for DO IDs
- [ ] Password hashing implemented
- [ ] JWT tokens managed properly
- [ ] Rate limiting in place
- [ ] Organization access control used (`getOrganization`, `setOrganizationContext`)
- [ ] WebSocket authentication secured

### Pragmatism
- [ ] Each line serves a purpose
- [ ] No premature abstractions
- [ ] Clear error messages
- [ ] Minimal dependencies
- [ ] Built-in features used instead of custom implementations
- [ ] Decision framework applied before adding complexity

### Real-time Features
- [ ] WebSocket events properly typed
- [ ] Real-time broadcasting used efficiently
- [ ] Browser client integration implemented correctly
- [ ] Table change events handled appropriately

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

// Test organization features
test('organization workflow', async () => {
  const teamDO = await getUserDO(env.TEAM_DO, 'owner@example.com') as TeamDO;
  
  // Create organization
  const org = await teamDO.createOrganization('Test Team');
  expect(org.id).toBeDefined();
  
  // Add member
  await teamDO.addOrganizationMember(org.id, 'member@example.com', 'admin');
  
  // Test member can access organization data
  const memberDO = await getUserDO(env.TEAM_DO, 'member@example.com') as TeamDO;
  const { memberOrganizations } = await memberDO.getOrganizations();
  expect(memberOrganizations).toHaveLength(1);
});

// Test real-time features
test('real-time broadcasting', async () => {
  const userDO = await getUserDO(env.TEST_DO, 'test@example.com');
  
  // Simulate WebSocket connection and data change
  await userDO.set('preferences', { theme: 'dark' });
  
  // Verify broadcast event (implementation depends on test setup)
  // expect(lastBroadcastEvent).toMatchObject({ key: 'preferences', data: { theme: 'dark' } });
});
```

## Performance Monitoring

Key metrics to track:
- DO instantiation time
- Query execution time
- Memory usage per DO
- Token validation latency
- Database operation throughput

## Pragmatic Mantras

- "The perfect is the enemy of the good"
- "You ain't gonna need it" (YAGNI)
- "Leave it better than you found it" (but only if it's actually better)
- "Working simple code beats theoretically better complex code"

## Conclusion

The userdo package embodies pragmatic design: powerful enough for production, simple enough to understand. When extending it, maintain this balance. Every line of code is a commitment to maintain, debug, and optimize. Make each one count.