# UserDO Examples

This directory contains example projects demonstrating UserDO integration with various frameworks and deployment platforms.

## Available Examples

- **[hono/](./hono/)** - Full-featured Hono integration with UserDO
- **[effect/](./effect/)** - Effect library integration 
- **[alchemy/](./alchemy/)** - Alchemy.run deployment example
- **[sveltekit2/](./sveltekit2/)** - Updated SvelteKit example with modern setup
- **[multi-tenant/](./multi-tenant/)** - Multi-tenant patterns

## Setting Up Examples

### Important: Linking UserDO

All examples use the local UserDO package from the repository root. You **must** properly link it before running any example:

#### 1. Link UserDO globally (from repo root)

```bash
# From the repository root (/srv/userdo)
cd /srv/userdo
bun link
```

This registers the `userdo` package globally so it can be linked in examples.

#### 2. Link UserDO in each example

```bash
# For each example directory
cd examples/[example-name]
bun link userdo
bun install
```

#### 3. Alternative: Use the link syntax in package.json

Examples use this dependency format in their `package.json`:

```json
{
  "dependencies": {
    "userdo": "link:userdo"
  }
}
```

### Why This Is Necessary

- **Bun file: dependencies hang**: `"userdo": "file:../../"` causes bun install to hang
- **Development workflow**: Examples need to use the latest local UserDO code
- **Type safety**: Proper linking ensures TypeScript resolution works correctly

### Common Issues

#### Bun Install Hangs
If `bun install` hangs, you're likely using `file:` dependencies instead of `link:`:

```bash
# ❌ This hangs
"userdo": "file:../../"

# ✅ Use this instead
"userdo": "link:userdo"
```

#### Module Resolution Errors
If you see `Cannot find module 'userdo'`:

1. Ensure you've run `bun link` from the repo root
2. Ensure you've run `bun link userdo` in the example directory
3. Check that `package.json` uses `"userdo": "link:userdo"`

#### Vite/SvelteKit Issues
Some examples may have Vite configuration issues with Cloudflare Workers types. See individual example READMEs for framework-specific setup.

## Running Examples

Each example has its own README with specific instructions. Generally:

```bash
# 1. Link UserDO (from repo root)
cd /srv/userdo && bun link

# 2. Go to example and link + install
cd examples/[example-name]
bun link userdo
bun install

# 3. Run the example (varies by example)
npm run dev
# or
node dev.mjs
# or
bun run dev
```

## Contributing Examples

When creating new examples:

1. Use `"userdo": "link:userdo"` in package.json
2. Document the linking process in the example's README
3. Test that the example works after a fresh `bun link` setup
4. Include both local development and production deployment instructions 