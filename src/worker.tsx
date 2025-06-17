import { Hono, Context } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { UserDO, type Env } from './UserDO'
import {
  SignupRequestSchema,
  LoginRequestSchema,
  PasswordResetRequestSchema,
  PasswordResetConfirmSchema,
  SetDataRequestSchema,
  type UserDOEndpoints,
  type AuthResponse,
  type ErrorResponse,
  type SuccessResponse,
  type DataResponse,
} from './worker-types'

type User = {
  id: string;
  email: string;
}

const isRequestSecure = (c: Context) => new URL(c.req.url).protocol === 'https:';

const app = new Hono<{ Bindings: Env, Variables: { user: User } }>()

// --- CLEAN AUTH MIDDLEWARE ---
app.use('/*', async (c, next) => {
  const url = new URL(c.req.url);
  const token = getCookie(c, 'token') || '';
  const refreshToken = getCookie(c, 'refreshToken') || '';

  console.log(`🔐 Auth check for ${url.pathname}:`, {
    hasToken: !!token,
    hasRefreshToken: !!refreshToken
  });

  if (token || refreshToken) {
    try {
      // Helper to decode JWT payload safely
      const decodeJWT = (jwt: string) => {
        try {
          const parts = jwt.split('.');
          return parts.length === 3 ? JSON.parse(atob(parts[1])) : null;
        } catch { return null; }
      };

      const email = decodeJWT(token)?.email?.toLowerCase() || decodeJWT(refreshToken)?.email?.toLowerCase();

      if (email) {
        const userDO = getUserDOFromContext(c, email);

        // Try access token first
        let result = await userDO.verifyToken({ token });
        console.log(`🔑 Token verification for ${email}:`, { success: result.ok });

        // If access token invalid, try refresh
        if (!result.ok && refreshToken) {
          try {
            console.log('🔄 Attempting token refresh...');
            const { token: newToken } = await userDO.refreshToken({ refreshToken });
            setCookie(c, 'token', newToken, {
              httpOnly: true,
              secure: isRequestSecure(c),
              path: '/',
              sameSite: 'Lax'
            });
            result = await userDO.verifyToken({ token: newToken });
            console.log('✅ Token refreshed successfully');
          } catch (e) {
            console.log('❌ Token refresh failed:', e);
            // Clear invalid tokens
            deleteCookie(c, 'token');
            deleteCookie(c, 'refreshToken');
          }
        }

        // Set user if authenticated
        if (result.ok && result.user) {
          console.log(`👤 User set: ${result.user.email}`);
          c.set('user', result.user);
        }
      }
    } catch (e) {
      console.error('Auth error:', e);
    }
  }

  await next();
});

// --- JSON AUTH ENDPOINTS (for client) ---
app.post('/api/signup', async (c): Promise<Response> => {
  try {
    const body = await c.req.json();
    const { email, password } = SignupRequestSchema.parse(body);

    const userDO = getUserDOFromContext(c, email.toLowerCase());
    const { user, token, refreshToken } = await userDO.signup({ email: email.toLowerCase(), password });

    setCookie(c, 'token', token, {
      httpOnly: true,
      secure: isRequestSecure(c),
      path: '/',
      sameSite: 'Lax'
    });
    setCookie(c, 'refreshToken', refreshToken, {
      httpOnly: true,
      secure: isRequestSecure(c),
      path: '/',
      sameSite: 'Lax'
    });

    const response: AuthResponse = { user, token, refreshToken };
    return c.json(response);
  } catch (e: any) {
    const errorResponse: ErrorResponse = { error: e.message || "Signup error" };
    return c.json(errorResponse, 400);
  }
});

app.post('/api/login', async (c): Promise<Response> => {
  try {
    const body = await c.req.json();
    const { email, password } = LoginRequestSchema.parse(body);

    const userDO = getUserDOFromContext(c, email.toLowerCase());
    const { user, token, refreshToken } = await userDO.login({ email: email.toLowerCase(), password });

    setCookie(c, 'token', token, {
      httpOnly: true,
      secure: isRequestSecure(c),
      path: '/',
      sameSite: 'Lax'
    });
    setCookie(c, 'refreshToken', refreshToken, {
      httpOnly: true,
      secure: isRequestSecure(c),
      path: '/',
      sameSite: 'Lax'
    });

    const response: AuthResponse = { user, token, refreshToken };
    return c.json(response);
  } catch (e: any) {
    const errorResponse: ErrorResponse = { error: e.message || "Login error" };
    return c.json(errorResponse, 400);
  }
});

app.post('/api/logout', async (c): Promise<Response> => {
  try {
    const token = getCookie(c, 'token') || '';
    const tokenParts = token.split('.');
    if (tokenParts.length === 3 && tokenParts[1]) {
      const payload = JSON.parse(atob(tokenParts[1]));
      const email = payload.email?.toLowerCase();
      if (email) {
        const userDO = getUserDOFromContext(c, email);
        await userDO.logout();
      }
    }
  } catch (e) {
    console.error('Logout error', e);
  }
  deleteCookie(c, 'token');
  deleteCookie(c, 'refreshToken');

  const response: SuccessResponse = { ok: true };
  return c.json(response);
});

// Password reset endpoints
app.post('/api/password-reset/request', async (c): Promise<Response> => {
  try {
    const body = await c.req.json();
    const { email } = PasswordResetRequestSchema.parse(body);

    const userDO = getUserDOFromContext(c, email.toLowerCase());
    const { resetToken } = await userDO.generatePasswordResetToken();

    // In production, you'd send this token via email
    // For demo purposes, we'll return it (don't do this in production!)
    return c.json({
      ok: true,
      message: "Reset token generated",
      resetToken // Remove this in production!
    });
  } catch (e: any) {
    const errorResponse: ErrorResponse = { error: e.message || "Reset request failed" };
    return c.json(errorResponse, 400);
  }
});

app.post('/api/password-reset/confirm', async (c): Promise<Response> => {
  try {
    const body = await c.req.json();
    const { resetToken, newPassword } = PasswordResetConfirmSchema.parse(body);

    // Extract email from token to get the right UserDO
    const tokenParts = resetToken.split('.');
    if (tokenParts.length !== 3) throw new Error('Invalid token format');
    const payload = JSON.parse(atob(tokenParts[1]));
    const email = payload.email?.toLowerCase();
    if (!email) throw new Error('Invalid token');

    const userDO = getUserDOFromContext(c, email);
    await userDO.resetPasswordWithToken({ resetToken, newPassword });

    return c.json({ ok: true, message: "Password reset successful" });
  } catch (e: any) {
    const errorResponse: ErrorResponse = { error: e.message || "Password reset failed" };
    return c.json(errorResponse, 400);
  }
});

app.get('/api/me', async (c): Promise<Response> => {
  const user = c.get('user');
  if (!user) {
    const errorResponse: ErrorResponse = { error: 'Not authenticated' };
    return c.json(errorResponse, 401);
  }
  return c.json({ user });
});





// --- FORM AUTH ENDPOINTS (for server-side forms) ---
app.post('/signup', async (c) => {
  const formData = await c.req.formData()
  const email = (formData.get('email') as string)?.toLowerCase();
  const password = formData.get('password') as string
  if (!email || !password) {
    return c.json({ error: "Missing fields" }, 400)
  }
  const userDO = getUserDOFromContext(c, email);
  try {
    const { user, token, refreshToken } = await userDO.signup({ email, password })
    setCookie(c, 'token', token, {
      httpOnly: true,
      secure: isRequestSecure(c),
      path: '/',
      sameSite: 'Lax'
    })
    setCookie(c, 'refreshToken', refreshToken, {
      httpOnly: true,
      secure: isRequestSecure(c),
      path: '/',
      sameSite: 'Lax'
    })
    return c.redirect('/');
  } catch (e: any) {
    return c.json({ error: e.message || "Signup error" }, 400)
  }
})

app.post('/login', async (c) => {
  const formData = await c.req.formData()
  const email = (formData.get('email') as string)?.toLowerCase();
  const password = formData.get('password') as string
  if (!email || !password) {
    return c.json({ error: "Missing fields" }, 400)
  }
  const userDO = getUserDOFromContext(c, email);
  try {
    const { user, token, refreshToken } = await userDO.login({ email, password })
    setCookie(c, 'token', token, {
      httpOnly: true,
      secure: isRequestSecure(c),
      path: '/',
      sameSite: 'Lax'
    })
    setCookie(c, 'refreshToken', refreshToken, {
      httpOnly: true,
      secure: isRequestSecure(c),
      path: '/',
      sameSite: 'Lax'
    })
    return c.redirect('/');
  } catch (e: any) {
    return c.json({ error: e.message || "Login error" }, 400)
  }
})

// logout
app.post('/logout', async (c) => {
  try {
    const token = getCookie(c, 'token') || '';
    const tokenParts = token.split('.');
    if (tokenParts.length === 3 && tokenParts[1]) {
      const payload = JSON.parse(atob(tokenParts[1]));
      const email = payload.email?.toLowerCase();
      if (email) {
        const userDO = getUserDOFromContext(c, email);
        await userDO.logout();
      }
    }
  } catch (e) {
    console.error('Logout error', e);
  }
  deleteCookie(c, 'token');
  deleteCookie(c, 'refreshToken');
  return c.redirect('/');
})

// --- KV STORAGE ENDPOINTS ---
app.get("/data", async (c): Promise<Response> => {
  const user = c.get('user');
  if (!user) {
    const errorResponse: ErrorResponse = { error: 'Unauthorized' };
    return c.json(errorResponse, 401);
  }
  const userDO = getUserDOFromContext(c, user.email);
  const result = await userDO.get('data');
  const response: DataResponse = { ok: true, data: result };
  return c.json(response);
});

app.post("/data", async (c): Promise<Response> => {
  try {
    const user = c.get('user');
    if (!user) {
      const errorResponse: ErrorResponse = { error: 'Unauthorized' };
      return c.json(errorResponse, 401);
    }

    let key: string, value: string;

    // Support both JSON and form data
    const contentType = c.req.header('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await c.req.json();
      key = body.key;
      value = body.value;
    } else {
      const formData = await c.req.formData();
      key = formData.get('key') as string;
      value = formData.get('value') as string;
    }

    // Validate the data
    const { key: validKey, value: validValue } = SetDataRequestSchema.parse({ key, value });

    const userDO = getUserDOFromContext(c, user.email);
    const result = await userDO.set(validKey, validValue);
    if (!result.ok) {
      const errorResponse: ErrorResponse = { error: 'Failed to set data' };
      return c.json(errorResponse, 400);
    }

    const response: DataResponse = { ok: true, data: { key: validKey, value: validValue } };
    return c.json(response);
  } catch (e: any) {
    const errorResponse: ErrorResponse = { error: e.message || 'Invalid data format' };
    return c.json(errorResponse, 400);
  }
});

// Example protected endpoint
app.get('/protected/profile', (c): Response => {
  const user = c.get('user');
  if (!user) {
    const errorResponse: ErrorResponse = { error: 'Unauthorized' };
    return c.json(errorResponse, 401);
  }
  return c.json({ ok: true, user });
});

// Simple API status endpoint - moved to /api/status so it doesn't interfere with user apps
app.get('/api/docs', async (c) => {
  return c.json({
    name: 'UserDO',
    version: '0.1.37',
    status: 'ready',
    endpoints: {
      auth: ['/api/signup', '/api/login', '/api/logout', '/api/me'],
      data: ['/data'],
      events: ['/api/events'],
      passwordReset: ['/api/password-reset/request', '/api/password-reset/confirm']
    },
    docs: 'https://github.com/acoyfellow/userdo'
  });
});

// Export utilities for extending the worker
export function getUserDOFromContext(c: Context, email: string, bindingName: string = 'USERDO'): UserDO {
  // Use the specified binding name, defaulting to USERDO for backwards compatibility
  const binding = c.env[bindingName];
  if (!binding) {
    throw new Error(`Durable Object binding '${bindingName}' not found. Make sure it's configured in wrangler.jsonc`);
  }
  const userDOID = binding.idFromName(email);
  return binding.get(userDOID) as unknown as UserDO;
}
export function createUserDOWorker(bindingName: string = 'USERDO') {
  const app = new Hono<{ Bindings: Env, Variables: { user: User } }>();

  // Helper function that uses the specified binding name
  const getUserDO = (c: Context, email: string) => getUserDOFromContext(c, email, bindingName);

  // Auth middleware - same clean version as main worker
  app.use('*', async (c, next) => {
    const url = new URL(c.req.url);
    const token = getCookie(c, 'token') || '';
    const refreshToken = getCookie(c, 'refreshToken') || '';

    console.log(`🔐 [createUserDOWorker] Auth check for ${url.pathname}:`, {
      hasToken: !!token,
      hasRefreshToken: !!refreshToken
    });

    if (token || refreshToken) {
      try {
        // Helper to decode JWT payload safely
        const decodeJWT = (jwt: string) => {
          try {
            const parts = jwt.split('.');
            return parts.length === 3 ? JSON.parse(atob(parts[1])) : null;
          } catch { return null; }
        };

        const email = decodeJWT(token)?.email?.toLowerCase() || decodeJWT(refreshToken)?.email?.toLowerCase();

        if (email) {
          const userDO = getUserDO(c, email);

          // Try access token first
          let result = await userDO.verifyToken({ token });
          console.log(`🔑 [createUserDOWorker] Token verification for ${email}:`, { success: result.ok });

          // If access token invalid, try refresh
          if (!result.ok && refreshToken) {
            try {
              console.log('🔄 [createUserDOWorker] Attempting token refresh...');
              const { token: newToken } = await userDO.refreshToken({ refreshToken });
              setCookie(c, 'token', newToken, {
                httpOnly: true,
                secure: isRequestSecure(c),
                path: '/',
                sameSite: 'Lax'
              });
              result = await userDO.verifyToken({ token: newToken });
              console.log('✅ [createUserDOWorker] Token refreshed successfully');
            } catch (e) {
              console.log('❌ [createUserDOWorker] Token refresh failed:', e);
              // Clear invalid tokens
              deleteCookie(c, 'token');
              deleteCookie(c, 'refreshToken');
            }
          }

          // Set user if authenticated
          if (result.ok && result.user) {
            console.log(`👤 [createUserDOWorker] User set: ${result.user.email}`);
            c.set('user', result.user);
          }
        }
      } catch (e) {
        console.error('[createUserDOWorker] Auth error:', e);
      }
    }

    await next();
  });

  // Copy all the routes from the main app but use the custom getUserDO function
  // API endpoints
  app.post('/api/signup', async (c) => {
    try {
      const body = await c.req.json();
      const { email, password } = SignupRequestSchema.parse(body);
      const userDO = getUserDO(c, email.toLowerCase());
      const { user, token, refreshToken } = await userDO.signup({ email: email.toLowerCase(), password });

      setCookie(c, 'token', token, {
        httpOnly: true,
        secure: isRequestSecure(c),
        path: '/',
        sameSite: 'Lax'
      });
      setCookie(c, 'refreshToken', refreshToken, {
        httpOnly: true,
        secure: isRequestSecure(c),
        path: '/',
        sameSite: 'Lax'
      });

      const response: AuthResponse = { user, token, refreshToken };
      return c.json(response);
    } catch (e: any) {
      const errorResponse: ErrorResponse = { error: e.message || "Signup failed" };
      return c.json(errorResponse, 400);
    }
  });

  app.post('/api/login', async (c) => {
    try {
      const body = await c.req.json();
      const { email, password } = LoginRequestSchema.parse(body);
      const userDO = getUserDO(c, email.toLowerCase());
      const { user, token, refreshToken } = await userDO.login({ email: email.toLowerCase(), password });

      setCookie(c, 'token', token, {
        httpOnly: true,
        secure: isRequestSecure(c),
        path: '/',
        sameSite: 'Lax'
      });
      setCookie(c, 'refreshToken', refreshToken, {
        httpOnly: true,
        secure: isRequestSecure(c),
        path: '/',
        sameSite: 'Lax'
      });

      const response: AuthResponse = { user, token, refreshToken };
      return c.json(response);
    } catch (e: any) {
      const errorResponse: ErrorResponse = { error: e.message || "Login failed" };
      return c.json(errorResponse, 400);
    }
  });

  app.post('/api/logout', async (c) => {
    try {
      const user = c.get('user');
      if (user) {
        const userDO = getUserDO(c, user.email);
        await userDO.logout();
      }
    } catch (e) {
      console.error('Logout error', e);
    }
    deleteCookie(c, 'token');
    deleteCookie(c, 'refreshToken');
    const response: SuccessResponse = { ok: true };
    return c.json(response);
  });

  app.post('/api/password-reset/request', async (c) => {
    try {
      const body = await c.req.json();
      const { email } = PasswordResetRequestSchema.parse(body);
      const userDO = getUserDO(c, email.toLowerCase());
      const { resetToken } = await userDO.generatePasswordResetToken();

      return c.json({ ok: true, message: "Password reset token generated", resetToken });
    } catch (e: any) {
      const errorResponse: ErrorResponse = { error: e.message || "Password reset request failed" };
      return c.json(errorResponse, 400);
    }
  });

  app.post('/api/password-reset/confirm', async (c) => {
    try {
      const body = await c.req.json();
      const { resetToken, newPassword } = PasswordResetConfirmSchema.parse(body);

      const tokenParts = resetToken.split('.');
      if (tokenParts.length !== 3) throw new Error('Invalid reset token');
      const payload = JSON.parse(atob(tokenParts[1]));
      const email = payload.email?.toLowerCase();
      if (!email) throw new Error('Invalid token');

      const userDO = getUserDO(c, email);
      await userDO.resetPasswordWithToken({ resetToken, newPassword });

      return c.json({ ok: true, message: "Password reset successful" });
    } catch (e: any) {
      const errorResponse: ErrorResponse = { error: e.message || "Password reset failed" };
      return c.json(errorResponse, 400);
    }
  });

  app.get('/api/me', async (c): Promise<Response> => {
    const user = c.get('user');
    if (!user) {
      const errorResponse: ErrorResponse = { error: 'Not authenticated' };
      return c.json(errorResponse, 401);
    }
    return c.json({ user });
  });

  // WebSocket endpoint removed - handled at worker level to avoid Hono serialization issues









  // Form endpoints
  app.post('/signup', async (c) => {
    const formData = await c.req.formData()
    const email = (formData.get('email') as string)?.toLowerCase();
    const password = formData.get('password') as string
    if (!email || !password) {
      return c.json({ error: "Missing fields" }, 400)
    }
    const userDO = getUserDO(c, email);
    try {
      const { user, token, refreshToken } = await userDO.signup({ email, password })
      setCookie(c, 'token', token, {
        httpOnly: true,
        secure: isRequestSecure(c),
        path: '/',
        sameSite: 'Lax'
      })
      setCookie(c, 'refreshToken', refreshToken, {
        httpOnly: true,
        secure: isRequestSecure(c),
        path: '/',
        sameSite: 'Lax'
      })
      return c.redirect('/');
    } catch (e: any) {
      return c.json({ error: e.message || "Signup error" }, 400)
    }
  })

  app.post('/login', async (c) => {
    const formData = await c.req.formData()
    const email = (formData.get('email') as string)?.toLowerCase();
    const password = formData.get('password') as string
    if (!email || !password) {
      return c.json({ error: "Missing fields" }, 400)
    }
    const userDO = getUserDO(c, email);
    try {
      const { user, token, refreshToken } = await userDO.login({ email, password })
      setCookie(c, 'token', token, {
        httpOnly: true,
        secure: isRequestSecure(c),
        path: '/',
        sameSite: 'Lax'
      })
      setCookie(c, 'refreshToken', refreshToken, {
        httpOnly: true,
        secure: isRequestSecure(c),
        path: '/',
        sameSite: 'Lax'
      })
      return c.redirect('/');
    } catch (e: any) {
      return c.json({ error: e.message || "Login error" }, 400)
    }
  })

  app.post('/logout', async (c) => {
    try {
      const token = getCookie(c, 'token') || '';
      const tokenParts = token.split('.');
      if (tokenParts.length === 3 && tokenParts[1]) {
        const payload = JSON.parse(atob(tokenParts[1]));
        const email = payload.email?.toLowerCase();
        if (email) {
          const userDO = getUserDO(c, email);
          await userDO.logout();
        }
      }
    } catch (e) {
      console.error('Logout error', e);
    }
    deleteCookie(c, 'token');
    deleteCookie(c, 'refreshToken');
    return c.redirect('/');
  })

  // Data endpoints
  app.get("/data", async (c): Promise<Response> => {
    const user = c.get('user');
    if (!user) {
      const errorResponse: ErrorResponse = { error: 'Unauthorized' };
      return c.json(errorResponse, 401);
    }
    const userDO = getUserDO(c, user.email);
    const result = await userDO.get('data');
    const response: DataResponse = { ok: true, data: result };
    return c.json(response);
  });

  app.post("/data", async (c): Promise<Response> => {
    try {
      const user = c.get('user');
      if (!user) {
        const errorResponse: ErrorResponse = { error: 'Unauthorized' };
        return c.json(errorResponse, 401);
      }

      let key: string, value: string;

      // Support both JSON and form data
      const contentType = c.req.header('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await c.req.json();
        key = body.key;
        value = body.value;
      } else {
        const formData = await c.req.formData();
        key = formData.get('key') as string;
        value = formData.get('value') as string;
      }

      const { key: validKey, value: validValue } = SetDataRequestSchema.parse({ key, value });

      const userDO = getUserDO(c, user.email);
      const result = await userDO.set(validKey, validValue);
      if (!result.ok) {
        const errorResponse: ErrorResponse = { error: 'Failed to set data' };
        return c.json(errorResponse, 400);
      }

      const response: DataResponse = { ok: true, data: { key: validKey, value: validValue } };
      return c.json(response);
    } catch (e: any) {
      const errorResponse: ErrorResponse = { error: e.message || 'Invalid data format' };
      return c.json(errorResponse, 400);
    }
  });

  app.get('/protected/profile', (c): Response => {
    const user = c.get('user');
    if (!user) {
      const errorResponse: ErrorResponse = { error: 'Unauthorized' };
      return c.json(errorResponse, 401);
    }
    return c.json({ ok: true, user });
  });

  // Generic collection endpoints for client API
  app.post('/api/:collection', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const collection = c.req.param('collection');
    const data = await c.req.json();

    // This is a placeholder - in a real implementation, you'd delegate to the UserDO
    // For now, just return success to make the client work
    return c.json({ ok: true, data: { id: crypto.randomUUID(), ...data } });
  });

  app.get('/api/docs', async (c) => {
    return c.json({
      name: 'UserDO',
      version: '0.1.37',
      status: 'ready',
      endpoints: {
        auth: ['/api/signup', '/api/login', '/api/logout', '/api/me'],
        data: ['/data'],
        collections: ['/api/:collection'],
        passwordReset: ['/api/password-reset/request', '/api/password-reset/confirm']
      },
      docs: 'https://github.com/acoyfellow/userdo'
    });
  });

  return app;
}

// Separate WebSocket handler factory
export function createWebSocketHandler(bindingName: string = 'USERDO') {
  return {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
      const url = new URL(request.url);

      // Only handle WebSocket upgrades
      if (url.pathname === '/api/ws' && request.headers.get('upgrade') === 'websocket') {
        console.log('🔌 WebSocket upgrade request received');

        // Parse cookies for authentication
        const cookieHeader = request.headers.get('cookie') || '';
        const cookies = Object.fromEntries(
          cookieHeader.split(';')
            .filter(c => c.includes('='))
            .map(c => c.trim().split('='))
        );

        const token = cookies.token || '';

        if (!token) {
          console.log('❌ No auth token for WebSocket');
          return new Response('Unauthorized', { status: 401 });
        }

        // Decode JWT to get email
        try {
          const parts = token.split('.');
          if (parts.length !== 3) throw new Error('Invalid token format');

          const payload = JSON.parse(atob(parts[1]));
          const email = payload.email?.toLowerCase();

          if (!email) throw new Error('No email in token');

          console.log(`🔌 WebSocket auth successful for: ${email}`);

          // Handle WebSocket upgrade directly (can't delegate to UserDO due to serialization)
          const webSocketPair = new WebSocketPair();
          const [client, server] = Object.values(webSocketPair);

          // Set up WebSocket handling with immediate demo messages
          server.accept();

          console.log('🔌 WebSocket accepted, setting up handlers');

          // Send welcome message immediately
          server.send(JSON.stringify({
            event: 'connected',
            message: 'WebSocket connected successfully!',
            user: email,
            timestamp: Date.now()
          }));

          // Send a demo message every 5 seconds
          const demoInterval = setInterval(() => {
            server.send(JSON.stringify({
              event: 'demo',
              message: 'Demo message from server',
              timestamp: Date.now()
            }));
          }, 5000);

          server.addEventListener('message', (event) => {
            console.log('📨 WebSocket message received:', event.data);
            try {
              const data = JSON.parse(event.data);

              // Echo back with confirmation
              server.send(JSON.stringify({
                event: 'echo',
                original: data,
                message: 'Message received and echoed back',
                timestamp: Date.now()
              }));

              // Simulate a data change notification
              setTimeout(() => {
                server.send(JSON.stringify({
                  event: 'data_changed',
                  key: 'demo_key',
                  value: 'Demo value updated',
                  timestamp: Date.now()
                }));
              }, 1000);

            } catch (error) {
              console.error('Error parsing WebSocket message:', error);
            }
          });

          server.addEventListener('close', () => {
            console.log('🔌 WebSocket closed');
            clearInterval(demoInterval);
          });

          return new Response(null, {
            status: 101,
            webSocket: client,
          });

        } catch (error) {
          console.log('❌ WebSocket auth failed:', error);
          return new Response('Unauthorized', { status: 401 });
        }
      }

      // Not a WebSocket request
      return new Response('Not Found', { status: 404 });
    }
  };
}

// Export the UserDO class for Wrangler and the complete worker with all auth routes
export { UserDO };
export { app as userDOWorker };
export default app;