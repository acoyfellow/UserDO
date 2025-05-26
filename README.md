# UserDO

A simple, secure, and ergonomic Durable Object for user authentication, management, and per-user key-value (KV) storage on Cloudflare Workers.

- 🔐 Password hashing (PBKDF2, WebCrypto)
- 🪪 JWT-based authentication (Cloudflare-native)
- 🏷️ Email as the Durable Object ID
- 🛠️ Direct method calls (no fetch, no HTTP routing)
- 🧩 Easy migration, password change, and reset
- 🗄️ Secure per-user KV store for arbitrary data

## What is this for?

- User authentication, management, and secure per-user data storage in Cloudflare Workers.
- No HTTP routing or fetch required—just call methods directly on your DO instance.
- Secure, scalable, and easy to integrate with any backend.


## Install
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/acoyfellow/userdo)
```bash
bun install userdo
```

## Wrangler Configuration

To use `userdo`, add your Durable Object binding to your `wrangler.jsonc`:

```jsonc
{
  // ...other config...
  "main": "src/index.ts", // or your entry file
  "vars": {
    "JWT_SECRET": "your-jwt-secret"
  },
  "durable_objects": {
    "bindings": [
      {
        "name": "USERDO",  // This is the variable you'll use in env.USERDO
        "class_name": "UserDO" // This must match the exported class name
      }
    ]
  }
}
```

- Make sure your entry file (e.g., `src/index.ts`) exports your Durable Object class:
  ```ts
  import { UserDO } from "userdo";
  export { UserDO };
  ```
- Use ES Module syntax (not service-worker style).

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

### 7. Get/Set User Data

You can store and retrieve custom data for each user using the `get` and `set` methods on the User Durable Object.

#### Set Data

```ts
// Set a value for a key (e.g., 'data')
const result = await userDO.set('data', 'your value');
// result: { ok: true }
```

#### Get Data

```ts
// Retrieve the value for a key (e.g., 'data')
const result = await userDO.get('data');
// result: { value: 'your value' }
```

- You can use any string as the key.
- The value can be any serializable data (string, object, etc.).
- Returns `{ ok: true }` for set, and `{ value }` for get.

## API

| Function                                      | Input                                                                 | Output                                  | Description                                      |
|------------------------------------------------|-----------------------------------------------------------------------|-----------------------------------------|--------------------------------------------------|
| `signup({ email, password })`                  | `{ email: string, password: string }`                                 | `{ user, token }`                       | Create a new user. Throws if email exists or input is invalid. |
| `login({ email, password })`                   | `{ email: string, password: string }`                                 | `{ user, token }`                       | Authenticate a user. Throws if credentials are invalid.        |
| `changePassword({ oldPassword, newPassword })` | `{ oldPassword: string, newPassword: string }`                        | `{ ok: true }`                          | Change the user's password. Throws if old password is wrong or new password is invalid. |
| `resetPassword({ newPassword })`               | `{ newPassword: string }`                                             | `{ ok: true }`                          | Reset the user's password (after verifying a reset token). Throws if new password is invalid. |
| `raw()`                                       | –                                                                     | `user`                                  | Get the raw user data. Throws if user does not exist.           |
| `init(user)`                                  | `user` (full user object, see below)                                  | `{ ok: true }`                          | Seed user data (for migration). Throws if input is invalid.     |
| `deleteUser()`                                | –                                                                     | `{ ok: true }`                          | Delete the user data.                                           |
| `migrateUserEmail({ env, oldEmail, newEmail })`| `{ env, oldEmail: string, newEmail: string }`                         | `{ ok: true }` or `{ ok: false, error }`| Atomically migrate a user to a new email. Returns error on failure. |

**User object shape:**
```ts
{
  id: string,
  email: string,
  passwordHash: string,
  salt: string,
  createdAt: string
}
```

- All methods throw on error unless otherwise noted.
- `token` is a JWT string for authentication.
- `user` is the user object as above.

---

**No HTTP endpoints. No fetch. Just Durable Object methods.**

## Security & Production Deployment

### Secret Key Handling
- **Never commit your `JWT_SECRET` to version control.**
- Store secrets in environment variables or your platform's secret manager (e.g., Cloudflare Workers Secrets, Vercel/Netlify/Render secrets, etc).
- Rotate your JWT secret regularly and after any suspected compromise.

### Production Safety Tips
- Always use HTTPS in production.
- Set `secure: true` and `httpOnly: true` for cookies (already set in this template).
- Use a strong, random JWT secret (at least 32+ characters).
- Consider adding rate limiting to authentication endpoints to prevent brute force attacks.
- Add email verification and password reset token validation for better account security.
- Set JWT expiry (`exp` claim) and handle token refresh/rotation as needed.
- Regularly audit your dependencies for vulnerabilities.

### Example: Setting a Secret in Cloudflare Workers
```sh
wrangler secret put JWT_SECRET
```

For more, see the [Cloudflare Workers docs on secrets](https://developers.cloudflare.com/workers/configuration/secrets/).

## Potential Roadmap

- [ ] Rate limiting for authentication endpoints
- [ ] Email verification flow
- [ ] Password reset with secure, time-limited tokens
- [ ] Configurable JWT expiration and refresh tokens
- [ ] Admin/user roles and permissions
- [ ] Webhooks or event hooks for user actions (signup, login, etc.)
- [ ] Multi-factor authentication (MFA)
- [ ] Usage analytics and audit logging

Have a feature request? Open an issue or PR!
