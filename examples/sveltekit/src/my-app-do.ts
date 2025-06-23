import { UserDO, type Env, type Table } from 'userdo';
import { z } from 'zod';

const PostSchema = z.object({
  title: z.string(),
  content: z.string(),
  createdAt: z.string(),
});

type Post = z.infer<typeof PostSchema>;

export class MyAppDO extends UserDO {
  posts: Table<Post>;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.posts = this.table('posts', PostSchema as any, { userScoped: true });
  }

  async createPost(title: string, content: string) {
    return this.posts.create({ title, content, createdAt: new Date().toISOString() });
  }

  async getPosts() {
    return this.posts.orderBy('createdAt', 'desc').get();
  }
}

export { MyAppDO as UserDO };
