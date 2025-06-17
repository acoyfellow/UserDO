export interface AuthResponse {
  user: { id: string; email: string };
  token: string;
  refreshToken: string;
}

export type Listener = (data: any) => void;

class UserDOClient {
  private user: { id: string; email: string } | null = null;
  private eventSource: EventSource | null = null;
  private listeners = new Map<string, Set<Listener>>();
  private authListeners = new Set<(user: { id: string; email: string } | null) => void>();

  constructor(private baseUrl: string) {
    this.checkAuthStatus();
  }

  private get headers() {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    // Cookies are automatically sent with requests, no need to manually add Authorization header
    return headers;
  }

  private async checkAuthStatus() {
    try {
      // Check if we're authenticated via cookies (same mechanism as server)
      const res = await fetch(`${this.baseUrl}/me`, {
        credentials: 'include' // Ensure cookies are sent
      });
      if (res.ok) {
        const data = await res.json() as { user: { id: string; email: string } };
        this.user = data.user;
      } else {
        this.user = null;
      }
    } catch {
      this.user = null;
    }
    this.emitAuthChange();
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

  async signup(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${this.baseUrl}/signup`, {
      method: "POST",
      headers: this.headers,
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as AuthResponse;
    this.user = data.user;
    this.emitAuthChange();
    return data;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${this.baseUrl}/login`, {
      method: "POST",
      headers: this.headers,
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as AuthResponse;
    this.user = data.user;
    this.emitAuthChange();
    return data;
  }

  async logout(): Promise<void> {
    await fetch(`${this.baseUrl}/logout`, {
      method: "POST",
      headers: this.headers,
      credentials: 'include'
    });
    this.user = null;
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
        const res = await fetch(base, {
          method: "POST",
          headers: client.headers,
          credentials: 'include',
          body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      },
      async findById(id: string) {
        const res = await fetch(`${base}/${id}`, {
          headers: client.headers,
          credentials: 'include'
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      },
      async update(id: string, updates: any) {
        const res = await fetch(`${base}/${id}`, {
          method: "PUT",
          headers: client.headers,
          credentials: 'include',
          body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      },
      async delete(id: string) {
        await fetch(`${base}/${id}`, {
          method: "DELETE",
          headers: client.headers,
          credentials: 'include'
        });
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
            const res = await fetch(`${base}?${qs}`, {
              headers: client.headers,
              credentials: 'include'
            });
            if (!res.ok) throw new Error(await res.text());
            return res.json();
          }
        };
      }
    };
  }
}

export { UserDOClient };
export default UserDOClient;
