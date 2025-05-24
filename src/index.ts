import { DurableObject } from 'cloudflare:workers';
import { z } from 'zod';
import jwt from '@tsndr/cloudflare-worker-jwt';

// --- User Schema ---
const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  passwordHash: z.string(),
  salt: z.string(),
  createdAt: z.string(),
});
type User = z.infer<typeof UserSchema>;

// --- Zod Schemas for endpoint validation ---
const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
const LoginSchema = SignupSchema;
const InitSchema = UserSchema;

// --- Password Hashing ---
const PASSWORD_CONFIG = {
  iterations: 310_000,
  saltLength: 16,
};

async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const encoder = new TextEncoder();
  const saltBytes = crypto.getRandomValues(new Uint8Array(PASSWORD_CONFIG.saltLength));
  const salt = btoa(String.fromCharCode(...saltBytes));
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
  const derivedBits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBytes, iterations: PASSWORD_CONFIG.iterations, hash: 'SHA-256' }, key, 256);
  const hash = btoa(String.fromCharCode(...new Uint8Array(derivedBits)));
  return { hash, salt };
}

async function verifyPassword(password: string, salt: string, expectedHash: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const saltBytes = Uint8Array.from(atob(salt), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
  const derivedBits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBytes, iterations: PASSWORD_CONFIG.iterations, hash: 'SHA-256' }, key, 256);
  const hash = btoa(String.fromCharCode(...new Uint8Array(derivedBits)));
  return hash === expectedHash;
}

export class UserDO extends DurableObject {
  state: DurableObjectState;
  storage: DurableObjectStorage;
  env: any;

  constructor(state: DurableObjectState, env: any) {
    super(state, env);
    this.state = state;
    this.storage = state.storage;
    this.env = env;
  }

  async signup({ email, password }: { email: string; password: string }) {
    const parsed = SignupSchema.safeParse({ email, password });
    if (!parsed.success) {
      throw new Error('Invalid input: ' + JSON.stringify(parsed.error.flatten()));
    }
    // Check if user already exists
    const existing = await this.storage.get<User>('data');
    if (existing) throw new Error('Email already registered');
    const id = this.state.id.toString();
    const createdAt = new Date().toISOString();
    const { hash, salt } = await hashPassword(password);
    const user: User = { id, email, passwordHash: hash, salt, createdAt };
    await this.storage.put('data', user);
    const token = await jwt.sign({ sub: user.id, email: user.email }, this.env.JWT_SECRET);
    return { user, token };
  }

  async login({ email, password }: { email: string; password: string }) {
    const parsed = LoginSchema.safeParse({ email, password });
    if (!parsed.success) {
      throw new Error('Invalid input: ' + JSON.stringify(parsed.error.flatten()));
    }
    const user = await this.storage.get<User>('data');
    if (!user || user.email !== email) throw new Error('Invalid credentials');
    const ok = await verifyPassword(password, user.salt, user.passwordHash);
    if (!ok) throw new Error('Invalid credentials');
    const token = await jwt.sign({ sub: user.id, email: user.email }, this.env.JWT_SECRET);
    return { user, token };
  }

  async raw() {
    const user = await this.storage.get<User>('data');
    if (!user) throw new Error('User not found');
    return user;
  }

  async init(user: User) {
    const parsed = InitSchema.safeParse(user);
    if (!parsed.success) {
      throw new Error('Invalid input: ' + JSON.stringify(parsed.error.flatten()));
    }
    await this.storage.put('data', user);
    return { ok: true };
  }

  async deleteUser() {
    await this.storage.delete('data');
    return { ok: true };
  }

  // Change password method
  async changePassword({ oldPassword, newPassword }: { oldPassword: string; newPassword: string }) {
    const user = await this.storage.get<User>('data');
    if (!user) throw new Error('User not found');
    // Validate old password
    const ok = await verifyPassword(oldPassword, user.salt, user.passwordHash);
    if (!ok) throw new Error('Invalid current password');
    // Validate new password
    const parsed = SignupSchema.shape.password.safeParse(newPassword);
    if (!parsed.success) {
      throw new Error('Invalid new password: ' + JSON.stringify(parsed.error.flatten()));
    }
    // Hash new password
    const { hash, salt } = await hashPassword(newPassword);
    user.passwordHash = hash;
    user.salt = salt;
    await this.storage.put('data', user);
    return { ok: true };
  }

  // Reset password method (for use after verifying a reset token)
  async resetPassword({ newPassword }: { newPassword: string }) {
    const user = await this.storage.get<User>('data');
    if (!user) throw new Error('User not found');
    // Validate new password
    const parsed = SignupSchema.shape.password.safeParse(newPassword);
    if (!parsed.success) {
      throw new Error('Invalid new password: ' + JSON.stringify(parsed.error.flatten()));
    }
    // Hash new password
    const { hash, salt } = await hashPassword(newPassword);
    user.passwordHash = hash;
    user.salt = salt;
    await this.storage.put('data', user);
    return { ok: true };
  }
}

export default {};

// Atomic migration helper (outside the class)
export async function migrateUserEmail({ env, oldEmail, newEmail }: { env: any; oldEmail: string; newEmail: string }) {
  const oldDO = env.USERDO.get(env.USERDO.idFromName(oldEmail));
  const newDO = env.USERDO.get(env.USERDO.idFromName(newEmail));
  try {
    const user = await oldDO.raw();
    user.email = newEmail;
    await newDO.init(user);
    await oldDO.deleteUser();
    return { ok: true };
  } catch (err) {
    // Optionally, add rollback logic here
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Usage Example (in your Worker or PartyServer):
 *
 * // Always use email as the DO ID:
 * const userDO = env.USERDO.get(env.USERDO.idFromName(email));
 *
 * // Signup
 * const { user, token } = await userDO.signup({ email, password });
 *
 * // Login
 * const { user: loggedInUser, token: loginToken } = await userDO.login({ email, password });
 *
 * // Change password
 * await userDO.changePassword({ oldPassword, newPassword });
 *
 * // Reset password (after verifying a reset token)
 * await userDO.resetPassword({ newPassword });
 *
 * // Change user email (migration):
 * const result = await migrateUserEmail({ env, oldEmail, newEmail });
 * if (!result.ok) {
 *   // handle error
 * }
 *
 * // You can wrap the migration in a helper for atomicity and error handling.
 */

// Two-tier system: You can use email or id as the DO id. For flexibility, you may want to store user data under both DOs (email and id) if you need both lookup types. For most use-cases, using email as the DO id is simplest for login/signup, and id for internal lookups. 