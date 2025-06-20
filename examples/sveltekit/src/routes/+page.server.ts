import type { PageServerLoad } from './$types';
import { getUserDO } from 'userdo';
import type { Env } from 'userdo';
import type { MyAppDO } from '../my-app-do';

export const load: PageServerLoad = async ({ platform }) => {
  const env = platform?.env as Env;
  const userDO = await getUserDO(env.MY_APP_DO, 'demo@example.com');
  const myAppDO = userDO as unknown as MyAppDO;

  const posts = await myAppDO.getPosts();
  return { posts };
};
