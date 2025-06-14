export interface AuthResponse {
  user: { id: string; email: string };
  token: string;
  refreshToken: string;
}

export type Listener = (data: any) => void;

export class UserDOClient {
  private token: string | null = null;
  private refreshToken: string | null = null;
  private user: { id: string; email: string } | null = null;
  private eventSource: EventSource | null = null;
  private listeners = new Map<string, Set<Listener>>();
  private authListeners = new Set<(user: { id: string; email: string } | null) => void>();
  private refreshTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(private baseUrl: string) {
    this.loadFromStorage();
  }

  private get headers() {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;
    return headers;
  }

  private persist() {
    if (typeof localStorage === "undefined") return;
    if (this.token) localStorage.setItem("userdo_token", this.token); else localStorage.removeItem("userdo_token");
    if (this.refreshToken) localStorage.setItem("userdo_refresh_token", this.refreshToken); else localStorage.removeItem("userdo_refresh_token");
  }

  private loadFromStorage() {
    if (typeof localStorage === "undefined") return;
    const t = localStorage.getItem("userdo_token");
    const r = localStorage.getItem("userdo_refresh_token");
    if (t) this.token = t;
    if (r) this.refreshToken = r;
    if (this.token) {
      this.updateUserFromToken();
      this.emitAuthChange();
    }
  }

  private decodeToken(token: string): { id: string; email: string; exp?: number } | null {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1]));
      if (!payload.sub || !payload.email) return null;
      return { id: payload.sub, email: payload.email, exp: payload.exp };
    } catch {
      return null;
    }
  }

  private scheduleRefresh(exp?: number) {
    if (!exp || !this.refreshToken) return;
    const ms = exp * 1000 - Date.now() - 5000;
    if (ms <= 0) return;
    if (this.refreshTimeout) clearTimeout(this.refreshTimeout);
    this.refreshTimeout = setTimeout(() => this.refreshAccessToken(), ms);
  }

  private updateUserFromToken() {
    if (!this.token) {
      this.user = null;
      return;
    }
    const info = this.decodeToken(this.token);
    if (!info) {
      this.user = null;
      return;
    }
    this.user = { id: info.id, email: info.email };
    this.scheduleRefresh(info.exp);
  }

  private emitAuthChange() {
    this.authListeners.forEach((l) => l(this.user));
  }

  onAuthStateChanged(listener: (user: { id: string; email: string } | null) => void) {
    this.authListeners.add(listener);
    listener(this.user);
  }

  offAuthStateChanged(listener: (user: { id: string; email: string } | null) => void) {
    this.authListeners.delete(listener);
  }

  private async refreshAccessToken() {
    if (!this.refreshToken) return;
    try {
      const res = await fetch(`${this.baseUrl}/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: this.refreshToken })
      });
      if (!res.ok) throw new Error(await res.text());
      const data: { token?: string } = await res.json();
      if (data.token) {
        this.token = data.token;
        this.persist();
        this.updateUserFromToken();
        this.emitAuthChange();
      }
    } catch {
      this.logout();
    }
  }

  async signup(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${this.baseUrl}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as AuthResponse;
    this.token = data.token;
    this.refreshToken = data.refreshToken;
    this.persist();
    this.updateUserFromToken();
    this.emitAuthChange();
    return data;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${this.baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as AuthResponse;
    this.token = data.token;
    this.refreshToken = data.refreshToken;
    this.persist();
    this.updateUserFromToken();
    this.emitAuthChange();
    return data;
  }

  async logout(): Promise<void> {
    await fetch(`${this.baseUrl}/logout`, {
      method: "POST",
      headers: this.headers
    });
    this.token = null;
    this.refreshToken = null;
    this.user = null;
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
    this.persist();
    this.emitAuthChange();
  }

  on(event: string, listener: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
  }

  off(event: string, listener: Listener) {
    this.listeners.get(event)?.delete(listener);
  }

  connectRealtime() {
    if (this.eventSource) return;
    this.eventSource = new EventSource(`${this.baseUrl}/events`);
    this.eventSource.onmessage = (ev: MessageEvent) => {
      const data = typeof ev.data === "string" ? ev.data : "";
      if (!data) return;
      const parsed = JSON.parse(data);
      const listeners = this.listeners.get(ev.type) || new Set();
      listeners.forEach(l => l(parsed));
    };
  }

  collection(name: string) {
    const base = `${this.baseUrl}/${name}`;
    const client = this;
    return {
      async create(data: any) {
        const res = await fetch(base, { method: "POST", headers: client.headers, body: JSON.stringify(data) });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      },
      async findById(id: string) {
        const res = await fetch(`${base}/${id}`, { headers: client.headers });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      },
      async update(id: string, updates: any) {
        const res = await fetch(`${base}/${id}`, { method: "PUT", headers: client.headers, body: JSON.stringify(updates) });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      },
      async delete(id: string) {
        await fetch(`${base}/${id}`, { method: "DELETE", headers: client.headers });
      },
      query() {
        const params: Record<string, any> = {};
        return {
          where(field: string, op: string, value: any) {
            params["where"] = JSON.stringify([field, op, value]);
            return this;
          },
          orderBy(field: string, dir: "asc" | "desc" = "asc") {
            params["order"] = `${field}:${dir}`;
            return this;
          },
          limit(count: number) {
            params["limit"] = count;
            return this;
          },
          async get() {
            const qs = new URLSearchParams(params as any).toString();
            const res = await fetch(`${base}?${qs}`, { headers: client.headers });
            if (!res.ok) throw new Error(await res.text());
            return res.json();
          }
        };
      }
    };
  }
}

export default UserDOClient;
