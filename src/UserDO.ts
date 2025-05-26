import { DurableObject } from 'cloudflare:workers';
import { z } from 'zod';
import jwt, { JwtData } from '@tsndr/cloudflare-worker-jwt';

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
  iterations: 100_000,
  saltLength: 16,
};

const RESERVED_PREFIX = "__";
const AUTH_DATA_KEY = "__user";

function isReservedKey(key: string): boolean {
  return key.startsWith(RESERVED_PREFIX);
}

type JwtPayload = {
  sub: string;
  email: string;
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

export interface Env {
  JWT_SECRET: string;
  USERDO: DurableObjectNamespace;
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
    email = email.toLowerCase();
    const parsed = SignupSchema.safeParse({ email, password });
    if (!parsed.success) {
      throw new Error('Invalid input: ' + JSON.stringify(parsed.error.flatten()));
    }
    // Check if user already exists
    const existing = await this.storage.get<User>(AUTH_DATA_KEY);
    if (existing) throw new Error('Email already registered');
    const id = this.state.id.toString();
    const createdAt = new Date().toISOString();
    const { hash, salt } = await hashPassword(password);
    const user: User = {
      id,
      email,
      passwordHash: hash,
      salt,
      createdAt
    };
    await this.storage.put(AUTH_DATA_KEY, user);
    // Set JWT expiration to 7 days from now
    const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
    const token = await jwt.sign({
      sub: user.id,
      email: user.email,
      exp
    }, this.env.JWT_SECRET);
    return { user, token };
  }

  async login({ email, password }: { email: string; password: string }) {
    email = email.toLowerCase();
    const parsed = LoginSchema.safeParse({ email, password });
    if (!parsed.success) {
      throw new Error('Invalid input: ' + JSON.stringify(parsed.error.flatten()));
    }
    const user = await this.storage.get<User>(AUTH_DATA_KEY);
    if (!user || user.email !== email) throw new Error('Invalid credentials');
    const ok = await verifyPassword(password, user.salt, user.passwordHash);
    if (!ok) throw new Error('Invalid credentials');
    // Set JWT expiration to 7 days from now
    const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
    const token = await jwt.sign({ sub: user.id, email: user.email, exp }, this.env.JWT_SECRET);
    return { user, token };
  }

  async raw() {
    const user = await this.storage.get<User>(AUTH_DATA_KEY);
    if (!user) throw new Error('User not found');
    return user;
  }

  async init(user: User) {
    const parsed = InitSchema.safeParse(user);
    if (!parsed.success) {
      throw new Error('Invalid input: ' + JSON.stringify(parsed.error.flatten()));
    }
    await this.storage.put(AUTH_DATA_KEY, user);
    return { ok: true };
  }

  async deleteUser() {
    await this.storage.delete(AUTH_DATA_KEY);
    return { ok: true };
  }

  // Change password method
  async changePassword({ oldPassword, newPassword }: { oldPassword: string; newPassword: string }) {
    const user = await this.storage.get<User>(AUTH_DATA_KEY);
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
    await this.storage.put(AUTH_DATA_KEY, user);
    return { ok: true };
  }

  // Reset password method (for use after verifying a reset token)
  async resetPassword({ newPassword }: { newPassword: string }) {
    const user = await this.storage.get<User>(AUTH_DATA_KEY);
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
    await this.storage.put(AUTH_DATA_KEY, user);
    return { ok: true };
  }

  async verifyToken({ token }: { token: string }) {
    try {
      const verify = await jwt.verify(
        token, this.env.JWT_SECRET
      ) as JwtData<JwtPayload, {}>;
      if (!verify) throw new Error('Invalid token');
      const { payload } = verify;
      if (!payload) throw new Error('Invalid token');
      const { sub, email } = payload as JwtPayload;
      if (!sub || !email) throw new Error('Invalid token');

      const user = await this.storage.get<User>(AUTH_DATA_KEY);
      if (!user) throw new Error('User not found');
      // Todo? can also check if payload.sub === user.id, etc.
      return { ok: true, user: { id: user.id, email: user.email } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async set(
    key: string,
    value: unknown
  ): Promise<{ ok: boolean }> {
    if (isReservedKey(key)) throw new Error("Key is reserved");
    await this.storage.put(key, value);
    return { ok: true };
  }

  async get(
    key: string
  ): Promise<{ value: unknown }> {
    if (isReservedKey(key)) throw new Error("Key is reserved");
    const value = await this.storage.get(key);
    return { value };
  }

}

// Atomic migration helper (outside the class)
export async function migrateUserEmail(
  { env, oldEmail, newEmail }
    : { env: any; oldEmail: string; newEmail: string }
): Promise<{ ok: boolean; error?: string }> {
  oldEmail = oldEmail.toLowerCase();
  newEmail = newEmail.toLowerCase();
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

export default {};