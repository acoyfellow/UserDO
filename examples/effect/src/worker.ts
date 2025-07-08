import { Effect } from "effect";
import { UserDO, getUserDO } from "userdo/server";
import { z } from "zod";

const email = "demo@example.com";
const password = "pass123098";

const PostSchema = z.object({
  title: z.string(),
  content: z.string(),
  createdAt: z.string(),
});

export class MyAppDO extends UserDO {
  posts = this.table("posts", PostSchema, { userScoped: true });

  // Regular async methods (not Effect-based)
  async createPost(title: string, content: string) {
    return this.posts.create({ title, content, createdAt: new Date().toISOString() });
  }

  async listPosts() {
    return this.posts.orderBy("createdAt", "desc").get();
  }
}

// Simple Effect example that doesn't use UserDO methods
function simpleEffect() {
  return Effect.gen(function* () {
    const result = yield* Effect.succeed("Hello from Effect!");
    return result;
  });
}

// Effect-based UserDO operations
function createPostEffect(stub: MyAppDO, title: string, content: string) {
  return Effect.tryPromise({
    try: () => stub.createPost(title, content),
    catch: (error: unknown) => new Error(`Failed to create post: ${error}`)
  });
}

function listPostsEffect(stub: MyAppDO) {
  return Effect.tryPromise({
    try: () => stub.listPosts(),
    catch: (error: unknown) => new Error(`Failed to list posts: ${error}`)
  });
}

function authEffect(stub: MyAppDO) {
  const signupEffect = Effect.tryPromise({
    try: () => stub.signup({ email, password }),
    catch: (error: unknown) => new Error(`Signup failed: ${error}`)
  });

  const loginEffect = Effect.tryPromise({
    try: () => stub.login({ email, password }),
    catch: (error: unknown) => new Error(`Login failed: ${error}`)
  });

  return signupEffect.pipe(
    Effect.catchAll(() => loginEffect)
  );
}

function fullFlow(stub: MyAppDO, title: string, content: string) {
  return Effect.gen(function* () {
    // Authenticate first
    yield* authEffect(stub);

    // Create a post
    yield* createPostEffect(stub, title, content);

    // List all posts
    const posts = yield* listPostsEffect(stub);
    return posts;
  });
}

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/simple") {
      const result = await Effect.runPromise(simpleEffect());
      return new Response(JSON.stringify({ message: result }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    if (url.pathname === "/posts") {
      try {
        const stub = await getUserDO<MyAppDO>(env.MY_APP_DO, email);
        const posts = await Effect.runPromise(
          fullFlow(stub, "My First Post", "This is the content of my first post!")
        );

        return new Response(JSON.stringify({ posts }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: error instanceof Error ? error.message : String(error)
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    return new Response("UserDO Effect Example\n\nTry:\n- /simple\n- /posts");
  }
};
