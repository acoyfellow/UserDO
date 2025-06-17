# Multi-Tenant Example

Same codebase, completely isolated tenants.

## What this shows

- `acme.example.com` users are stored in `ACME_DO`
- `globex.example.com` users are stored in `GLOBEX_DO`
- Zero data leakage between tenants
- One deployment, infinite tenants

## Key insight

```ts
// Each tenant gets their own worker with isolated data
const acmeWorker = createUserDOWorker('ACME_DO');
const globexWorker = createUserDOWorker('GLOBEX_DO');
```

## Try it

```bash
curl https://acme.your-domain.com/api/signup \
  -d '{"email":"user@acme.com","password":"password"}'

curl https://globex.your-domain.com/api/signup \
  -d '{"email":"user@globex.com","password":"password"}'
```

Same email, different tenants → completely separate users.

## Configuration

Two bindings, same class:

```jsonc
"durable_objects": {
  "bindings": [
    { "name": "ACME_DO", "class_name": "TenantDO" },
    { "name": "GLOBEX_DO", "class_name": "TenantDO" }
  ]
}
```

## Scale

Add new tenants by adding new bindings. No code changes needed. 