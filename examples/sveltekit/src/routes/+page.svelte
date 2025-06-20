<script lang="ts">
  export let data: { posts: any[] };
</script>

<h1>SvelteKit + UserDO</h1>

{#if data.posts.length === 0}
  <p>No posts yet.</p>
{:else}
  <ul>
    {#each data.posts as post}
      <li>{post.title} - {post.createdAt}</li>
    {/each}
  </ul>
{/if}
