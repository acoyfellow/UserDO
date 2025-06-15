import { Effect } from "effect";
import { UserDO, getUserDO } from "userdo";
import { z } from "zod";

const PostSchema = z.object({
  title: z.string(),
  content: z.string(),
  createdAt: z.string(),
});

export class MyAppDO extends UserDO {
  posts = this.table("posts", PostSchema, { userScoped: true });

  createPostEff(title: string, content: string) {
    return Effect.tryPromise(() =>
      this.posts.create({ title, content, createdAt: new Date().toISOString() })
    );
  }

  listPostsEff() {
    return Effect.tryPromise(() =>
      this.posts.orderBy("createdAt", "desc").get()
    );
  }
}

function fullFlow(stub: MyAppDO, title: string, content: string) {
  return Effect.gen(function* (_) {
    // Sign up on first run, otherwise just log in
    yield* _(Effect.tryPromise(() =>
      stub.signup({ email: "demo@example.com", password: "pass" })
    ).catchAll(() =>
      Effect.tryPromise(() =>
        stub.login({ email: "demo@example.com", password: "pass" })
      )
    ));

    yield* _(stub.createPostEff(title, content));
    return yield* _(stub.listPostsEff());
  });
}

export default {
  async fetch(request: Request, env: Env) {
    const stub = await getUserDO<MyAppDO>(env.MY_APP_DO, "demo@example.com");

    if (request.method === "POST") {
      const { title, content } = await request.json();
      const program = fullFlow(stub, title, content);
      const posts = await Effect.runPromise(program);
      return Response.json(posts);
    }

    const program = stub.listPostsEff();
    const posts = await Effect.runPromise(program);
    return Response.json(posts);
  },
};
