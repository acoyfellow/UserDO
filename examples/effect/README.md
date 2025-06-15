# UserDO + Effect Example

This example demonstrates how to orchestrate UserDO operations using the [Effect](https://github.com/Effect-TS/effect) library. The Effect runtime lets you compose asynchronous logic in a declarative way while keeping full type safety.

The worker defines a `MyAppDO` class that extends `UserDO` and exposes a small API for creating posts. We use `Effect` to chain user signup, authentication and data access without promise nesting.

```
import { Effect } from "effect";
import { MyAppDO } from "./worker";

const program = Effect.gen(function* (_) {
  // sign up once, or log in if the user already exists
  yield* _(
    Effect.tryPromise(() =>
      myAppDO.signup({ email: "demo@example.com", password: "pass" })
    ).catchAll(() =>
      Effect.tryPromise(() =>
        myAppDO.login({ email: "demo@example.com", password: "pass" })
      )
    )
  );
  yield* _(myAppDO.createPostEff("Hello", "from Effect"));
  return yield* _(myAppDO.listPostsEff());
});

Effect.runPromise(program).then(console.log);
```

Run `bun install` (or `npm install`) then `wrangler dev` to see the demo.
