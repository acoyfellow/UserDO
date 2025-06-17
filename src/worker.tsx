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

// --- AUTH MIDDLEWARE (must run before API routes) ---
app.use('/*', async (c, next) => {
  try {
    console.log('(WORKER)Auth middleware - URL:', c.req.url);
    const token = getCookie(c, 'token') || '';
    const refreshToken = getCookie(c, 'refreshToken') || '';

    // Helper function to safely decode JWT payload
    const decodeJWTPayload = (jwt: string) => {
      try {
        const parts = jwt.split('.');
        if (parts.length !== 3 || !parts[1]) return null;
        return JSON.parse(atob(parts[1]));
      } catch {
        return null;
      }
    };

    const accessPayload = decodeJWTPayload(token);
    const refreshPayload = decodeJWTPayload(refreshToken);
    let email = accessPayload?.email?.toLowerCase() || refreshPayload?.email?.toLowerCase();

    if (email) {
      const userDO = getUserDOFromContext(c, email);
      const result = await userDO.verifyToken({ token: token });
      if (!result.ok) {
        const refreshResult = await userDO.refreshToken({ refreshToken });
        if (!refreshResult.token) return c.json({ error: 'Unauthorized' }, 401);
        setCookie(c, 'token', refreshResult.token, {
          httpOnly: true,
          secure: isRequestSecure(c),
          path: '/',
          sameSite: 'Lax'
        });
        // Verify the new token and set user
        const newResult = await userDO.verifyToken({ token: refreshResult.token });
        if (newResult.ok && newResult.user) {
          c.set('user', newResult.user);
        }
      } else if (result.ok && result.user) {
        c.set('user', result.user);
      }
    }
    await next();
  } catch (e) {
    console.error(e);
    await next();
  };
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

// Events API for real-time updates (polling-based)
app.get('/api/events', async (c): Promise<Response> => {
  const user = c.get('user');
  if (!user) {
    const errorResponse: ErrorResponse = { error: 'Not authenticated' };
    return c.json(errorResponse, 401);
  }

  const userDO = getUserDOFromContext(c, user.email);
  const since = parseInt(c.req.query('since') || '0');
  const events = await userDO.getEvents(since);

  return c.json(events);
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
      sameSite: 'Strict'
    })
    setCookie(c, 'refreshToken', refreshToken, {
      httpOnly: true,
      secure: isRequestSecure(c),
      path: '/',
      sameSite: 'Strict'
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
      sameSite: 'Strict'
    })
    setCookie(c, 'refreshToken', refreshToken, {
      httpOnly: true,
      secure: isRequestSecure(c),
      path: '/',
      sameSite: 'Strict'
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

    const formData = await c.req.formData();
    const key = formData.get('key') as string;
    const value = formData.get('value') as string;

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
export function getUserDOFromContext(c: Context, email: string, namespace?: string): UserDO {
  // For now, ignore the namespace parameter and use the default USERDO
  // In the future, this could support multiple DO namespaces
  const userDOID = c.env.USERDO.idFromName(email);
  return c.env.USERDO.get(userDOID) as unknown as UserDO;
}
export function createUserDOWorker() {
  return new Hono<{ Bindings: Env, Variables: { user: User } }>();
}

// Export the UserDO class for Wrangler and the complete worker with all auth routes
export { UserDO };
export { app as userDOWorker };
export default app;