import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, fetch }) => {
  console.log('🏗️ SSR: Loading page data');

  // User is available from locals (set by hooks.server.ts)
  if (!locals.user) {
    console.log('🚫 SSR: No user, returning empty state');
    return {
      user: null,
      posts: []
    };
  }

  console.log('👤 SSR: User found, loading posts for:', locals.user.email);

  try {
    // Fetch posts server-side using the universal proxy
    const response = await fetch('/api/posts');

    if (response.ok) {
      const data = (await response.json()) as { posts: any[] };
      console.log('✅ SSR: Posts loaded:', data.posts?.length || 0);

      return {
        user: locals.user,
        posts: data.posts || []
      };
    } else {
      console.error('❌ SSR: Failed to load posts:', response.status);
      return {
        user: locals.user,
        posts: []
      };
    }
  } catch (error) {
    console.error('❌ SSR: Error loading posts:', error);
    return {
      user: locals.user,
      posts: []
    };
  }
}; 