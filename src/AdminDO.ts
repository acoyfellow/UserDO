import { DurableObject } from 'cloudflare:workers';
import type { Env as BaseEnv } from './UserDO';

export interface AdminEnv extends BaseEnv {
  USER_INDEX?: DurableObjectNamespace<AdminDO>;
}

export class AdminDO extends DurableObject {
  private state: DurableObjectState;
  private storage: DurableObjectStorage;

  constructor(state: DurableObjectState, env: AdminEnv) {
    super(state, env);
    this.state = state;
    this.storage = state.storage;
  }

  async addUser(email: string): Promise<void> {
    const users = await this.storage.get<string[]>('users') || [];
    if (!users.includes(email)) {
      users.push(email);
      await this.storage.put('users', users);
    }
  }

  async removeUser(email: string): Promise<void> {
    const users = await this.storage.get<string[]>('users') || [];
    const updated = users.filter(u => u !== email);
    await this.storage.put('users', updated);
  }

  async listUsers(): Promise<string[]> {
    return await this.storage.get<string[]>('users') || [];
  }
}

export default {};
