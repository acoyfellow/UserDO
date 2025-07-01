# Effect Integration Example

Learn how to use UserDO with the Effect library for functional programming patterns, error handling, and composable async operations.

## What You'll Learn

- How to integrate UserDO with Effect's functional programming approach
- Composing authentication and data operations without promise nesting
- Using Effect's error handling for robust applications
- Building type-safe, composable async workflows

## Why Use Effect with UserDO

- **Composable Operations**: Chain authentication, data access, and business logic declaratively
- **Better Error Handling**: Effect's error handling is more explicit than try/catch
- **Type Safety**: Full type inference across async operations
- **Functional Patterns**: Avoid callback hell and promise nesting

## Example Application

This example shows a blog application where you can:
- Sign up or log in users
- Create and list posts
- Handle errors gracefully using Effect patterns

## Key Patterns Demonstrated

### Composable Authentication and Data Access

```ts
import { Effect } from "effect";

const program = Effect.gen(function* (_) {
  // Sign up or log in (handles both cases)
  yield* _(
    Effect.tryPromise(() =>
      myAppDO.signup({ email: "demo@example.com", password: "pass" })
    ).catchAll(() =>
      Effect.tryPromise(() =>
        myAppDO.login({ email: "demo@example.com", password: "pass" })
      )
    )
  );

  // Create a post
  yield* _(myAppDO.createPostEff("Hello", "from Effect"));
  
  // Return all posts
  return yield* _(myAppDO.listPostsEff());
});

Effect.runPromise(program).then(console.log);
```

### UserDO with Effect Methods

```ts
export class MyAppDO extends UserDO {
  posts: Table<Post>;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.posts = this.table('posts', PostSchema, { userScoped: true });
  }

  // Effect-wrapped methods for functional composition
  createPostEff(title: string, content: string) {
    return Effect.tryPromise(() => 
      this.posts.create({
        title,
        content,
        createdAt: new Date().toISOString(),
      })
    );
  }

  listPostsEff() {
    return Effect.tryPromise(() => 
      this.posts.orderBy('createdAt', 'desc').get()
    );
  }
}
```

## Running the Example

```bash
cd examples/effect
bun install
bun run dev
```

The application will:
1. Attempt to sign up a demo user
2. If signup fails (user exists), log in instead
3. Create a blog post
4. List all posts
5. Display the results

## Error Handling Patterns

### Traditional Promise Approach
```ts
try {
  await myAppDO.signup({ email, password });
} catch (signupError) {
  try {
    await myAppDO.login({ email, password });
  } catch (loginError) {
    console.error("Both signup and login failed");
  }
}
```

### Effect Approach
```ts
const authProgram = Effect.tryPromise(() =>
  myAppDO.signup({ email, password })
).catchAll(() =>
  Effect.tryPromise(() =>
    myAppDO.login({ email, password })
  )
);
```

## Key Benefits

1. **Declarative Composition**: Chain operations without nested callbacks
2. **Explicit Error Handling**: Errors are part of the type system
3. **Better Testing**: Effect programs are easier to test and reason about
4. **Functional Patterns**: Avoid imperative code and side effects

## Learning Outcomes

After studying this example, you'll understand:

1. **How to wrap UserDO operations** in Effect for functional composition
2. **Error handling patterns** that are more explicit than try/catch
3. **Composing async operations** without promise nesting
4. **Building type-safe workflows** with full type inference

## Extending This Example

To use Effect patterns in your UserDO application:

1. Wrap your UserDO methods with `Effect.tryPromise()`
2. Use `Effect.gen()` for composing multiple operations
3. Handle errors with `catchAll()` or `catchTag()`
4. Run your Effect programs with `Effect.runPromise()`

This approach is especially useful for:
- Applications with complex async workflows
- Teams that prefer functional programming patterns
- Projects that need robust error handling
- Applications with multiple sequential operations
