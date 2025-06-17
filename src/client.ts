export interface AuthResponse {
  user: { id: string; email: string };
  token: string;
  refreshToken: string;
}

type ChangeListener = (data: any) => void;

class UserDOClient {
  private user: { id: string; email: string } | null = null;
  private authListeners = new Set<(user: { id: string; email: string } | null) => void>();
  private ws: WebSocket | null = null;
  private wsReconnectTimer: any = null;
  private changeListeners = new Map<string, Set<ChangeListener>>();
  private isConnecting = false;

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

    console.log('🔐 Auth state changed, checking WebSocket connection...', {
      user: this.user,
      hasWs: !!this.ws,
      isConnecting: this.isConnecting
    });

    // Connect/disconnect WebSocket based on auth state
    if (this.user && !this.ws) {
      console.log('🔌 Triggering WebSocket connection...');
      this.connectWebSocket();
    } else if (!this.user && this.ws) {
      console.log('🔌 Disconnecting WebSocket (user logged out)...');
      this.disconnectWebSocket();
    } else if (this.user && this.ws) {
      console.log('🔌 WebSocket already connected');
    } else {
      console.log('🔌 No user, no WebSocket connection needed');
    }
  }

  private connectWebSocket() {
    if (this.isConnecting || this.ws) return;

    this.isConnecting = true;

    // Build WebSocket URL from current page origin
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}${this.baseUrl}/ws`;

    console.log('🔌 Attempting WebSocket connection to:', wsUrl);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('🔌 WebSocket connected');
        this.isConnecting = false;
        if (this.wsReconnectTimer) {
          clearTimeout(this.wsReconnectTimer);
          this.wsReconnectTimer = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleRealtimeMessage(message);
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        this.ws = null;
        this.isConnecting = false;

        // Auto-reconnect if user is still authenticated
        if (this.user && !this.wsReconnectTimer) {
          this.wsReconnectTimer = setTimeout(() => {
            this.wsReconnectTimer = null;
            this.connectWebSocket();
          }, 3000); // Reconnect after 3 seconds
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
      };

    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.isConnecting = false;
    }
  }

  private disconnectWebSocket() {
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private handleRealtimeMessage(message: { event: string; data: any; timestamp: number }) {
    const listeners = this.changeListeners.get(message.event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(message.data);
        } catch (error) {
          console.error('Change listener error:', error);
        }
      });
    }
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
    this.disconnectWebSocket();
    this.emitAuthChange();
  }


  // KV Storage methods
  async get(key: string): Promise<any> {
    const res = await fetch(`${this.baseUrl.replace('/api', '')}/data?key=${encodeURIComponent(key)}`, {
      headers: this.headers,
      credentials: 'include'
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json() as { data: any };
    return data.data;
  }

  async set(key: string, value: any): Promise<{ ok: boolean }> {
    const res = await fetch(`${this.baseUrl.replace('/api', '')}/data`, {
      method: "POST",
      headers: this.headers,
      credentials: 'include',
      body: JSON.stringify({ key, value })
    });
    if (!res.ok) throw new Error(await res.text());
    return { ok: true };
  }

  // Watch KV changes
  onChange(key: string, listener: ChangeListener): () => void {
    const eventKey = `kv:${key}`;
    if (!this.changeListeners.has(eventKey)) {
      this.changeListeners.set(eventKey, new Set());
    }
    this.changeListeners.get(eventKey)!.add(listener);

    // Return unsubscribe function
    return () => {
      const listeners = this.changeListeners.get(eventKey);
      if (listeners) {
        listeners.delete(listener);
        if (listeners.size === 0) {
          this.changeListeners.delete(eventKey);
        }
      }
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
      // Watch collection changes
      onChange(listener: ChangeListener): () => void {
        const eventKey = `table:${name}`;
        if (!client.changeListeners.has(eventKey)) {
          client.changeListeners.set(eventKey, new Set());
        }
        client.changeListeners.get(eventKey)!.add(listener);

        // Return unsubscribe function
        return () => {
          const listeners = client.changeListeners.get(eventKey);
          if (listeners) {
            listeners.delete(listener);
            if (listeners.size === 0) {
              client.changeListeners.delete(eventKey);
            }
          }
        };
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
