# userdo

A simple, secure, and ergonomic Durable Object for user authentication and management on Cloudflare Workers.

- 🔐 Password hashing (PBKDF2, WebCrypto)
- 🪪 JWT-based authentication (Cloudflare-native)
- 🏷️ Email as the Durable Object ID
- 🛠️ Direct method calls (no fetch, no HTTP routing)
- 🧩 Easy migration, password change, and reset

## Install

```bash
npm install userdo
```

## Usage

### 1. Create or get a User Durable Object

```ts
import { UserDO } from "userdo";

// Always use email as the DO ID
const userDO = env.USERDO.get(env.USERDO.idFromName(email));
```

### 2. Signup

```ts
const { user, token } = await userDO.signup({ email, password });
```

### 3. Login

```ts
const { user, token } = await userDO.login({ email, password });
```

### 4. Change Password

```ts
await userDO.changePassword({ oldPassword, newPassword });
```

### 5. Reset Password (after verifying a reset token)

```ts
await userDO.resetPassword({ newPassword });
```

### 6. Change User Email (Migration)

```ts
import { migrateUserEmail } from "userdo";

const result = await migrateUserEmail({ env, oldEmail, newEmail });
if (!result.ok) {
  // handle error
}
```

## What is this for?

- User authentication and management in Cloudflare Workers, PartyKit, or any platform supporting Durable Objects.
- No HTTP routing or fetch required—just call methods directly on your DO instance.
- Secure, scalable, and easy to integrate with any backend.

## API

All methods throw on error and return `{ ok: true }` or `{ user, token }` as appropriate.

- `signup({ email, password })`
- `login({ email, password })`
- `changePassword({ oldPassword, newPassword })`
- `resetPassword({ newPassword })`
- `raw()` – get user data
- `init(user)` – seed user data (for migration)
- `deleteUser()` – delete user data
- `migrateUserEmail({ env, oldEmail, newEmail })` – atomic email migration helper

---

**No HTTP endpoints. No fetch. Just Durable Object methods.**
