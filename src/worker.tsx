import { Hono, Context } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { cors } from 'hono/cors'
import { createAuthMiddleware } from './authMiddleware.js'
import { UserDO, type Env } from './UserDO.js'
import {
  SignupRequestSchema,
  LoginRequestSchema,
  PasswordResetRequestSchema,
  PasswordResetConfirmSchema,
  SetDataRequestSchema,
  type AuthResponse,
  type ErrorResponse,
  type SuccessResponse,
  type DataResponse,
} from './worker-types.js'

type User = {
  id: string;
  email: string;
}

// --- UTILITIES ---
const isRequestSecure = (c: Context) => new URL(c.req.url).protocol === 'https:';

const setAuthCookies = (c: Context, token: string, refreshToken: string) => {
  const cookieOptions = {
    httpOnly: true,
    secure: isRequestSecure(c),
    path: '/',
    sameSite: 'Lax' as const
  };
  setCookie(c, 'token', token, cookieOptions);
  setCookie(c, 'refreshToken', refreshToken, cookieOptions);
};

const clearAuthCookies = (c: Context) => {
  deleteCookie(c, 'token');
  deleteCookie(c, 'refreshToken');
};

const parseBody = async (c: Context, schema: any) => {
  const contentType = c.req.header('content-type') || '';
  if (contentType.includes('application/json')) {
    return schema.parse(await c.req.json());
  } else {
    const formData = await c.req.formData();
    const entries: { [key: string]: any } = {};
    formData.forEach((value, key) => {
      entries[key] = value;
    });
    return schema.parse(entries);
  }
};

const handleError = (e: any, defaultMessage: string) => {
  const errorResponse: ErrorResponse = { error: e.message || defaultMessage };
  return { errorResponse, status: 400 as const };
};

const requireAuth = (c: Context) => {
  const user = c.get('user');
  if (!user) {
    throw new Error('Not authenticated');
  }
  return user;
};

// --- ROUTE FACTORY ---
function createRoutes(getUserDO: (c: Context, email: string) => UserDO) {
  const routes = new Hono<{ Bindings: Env, Variables: { user: User } }>();

  // CORS middleware (must come before auth middleware)
  routes.use('/*', cors({
    origin: (origin) => origin, // Allow all origins in development
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true, // Allow cookies
  }));

  // Auth middleware
  routes.use('/*', createAuthMiddleware(getUserDO));

  // --- API ENDPOINTS ---
  routes.post('/api/signup', async (c) => {
    try {
      const { email, password } = await parseBody(c, SignupRequestSchema);
      const userDO = getUserDO(c, email.toLowerCase());
      const { user, token, refreshToken } = await userDO.signup({ email: email.toLowerCase(), password });

      setAuthCookies(c, token, refreshToken);
      const response: AuthResponse = { user, token, refreshToken };
      return c.json(response);
    } catch (e: any) {
      const { errorResponse, status } = handleError(e, "Signup failed");
      return c.json(errorResponse, status);
    }
  });

  routes.post('/api/login', async (c) => {
    try {
      const { email, password } = await parseBody(c, LoginRequestSchema);
      const userDO = getUserDO(c, email.toLowerCase());
      const { user, token, refreshToken } = await userDO.login({ email: email.toLowerCase(), password });

      setAuthCookies(c, token, refreshToken);
      const response: AuthResponse = { user, token, refreshToken };
      return c.json(response);
    } catch (e: any) {
      const { errorResponse, status } = handleError(e, "Login failed");
      return c.json(errorResponse, status);
    }
  });

  routes.post('/api/logout', async (c) => {
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
    clearAuthCookies(c);
    const response: SuccessResponse = { ok: true };
    return c.json(response);
  });

  routes.post('/api/password-reset/request', async (c) => {
    try {
      const { email } = await parseBody(c, PasswordResetRequestSchema);
      const userDO = getUserDO(c, email.toLowerCase());
      const { resetToken } = await userDO.generatePasswordResetToken();

      return c.json({
        ok: true,
        message: "Reset token generated",
        resetToken // Remove this in production!
      });
    } catch (e: any) {
      const { errorResponse, status } = handleError(e, "Password reset request failed");
      return c.json(errorResponse, status);
    }
  });

  routes.post('/api/password-reset/confirm', async (c) => {
    try {
      const { resetToken, newPassword } = await parseBody(c, PasswordResetConfirmSchema);

      const tokenParts = resetToken.split('.');
      if (tokenParts.length !== 3) throw new Error('Invalid token format');
      const payload = JSON.parse(atob(tokenParts[1]));
      const email = payload.email?.toLowerCase();
      if (!email) throw new Error('Invalid token');

      const userDO = getUserDO(c, email);
      await userDO.resetPasswordWithToken({ resetToken, newPassword });

      return c.json({ ok: true, message: "Password reset successful" });
    } catch (e: any) {
      const { errorResponse, status } = handleError(e, "Password reset failed");
      return c.json(errorResponse, status);
    }
  });

  routes.get('/api/me', async (c) => {
    try {
      const user = requireAuth(c);
      return c.json({ user });
    } catch (e: any) {
      const { errorResponse } = handleError(e, "Not authenticated");
      return c.json(errorResponse, 401);
    }
  });

  // --- FORM ENDPOINTS ---
  const handleFormAuth = async (c: Context, action: 'signup' | 'login') => {
    try {
      const formData = await c.req.formData();
      const email = (formData.get('email') as string)?.toLowerCase();
      const password = formData.get('password') as string;

      if (!email || !password) {
        return c.json({ error: "Missing fields" }, 400);
      }

      const userDO = getUserDO(c, email);
      const { user, token, refreshToken } = await userDO[action]({ email, password });

      setAuthCookies(c, token, refreshToken);
      return c.redirect('/');
    } catch (e: any) {
      return c.json({ error: e.message || `${action} error` }, 400);
    }
  };

  routes.post('/signup', (c) => handleFormAuth(c, 'signup'));
  routes.post('/login', (c) => handleFormAuth(c, 'login'));

  // Shared logout handler
  const handleLogout = async (c: Context) => {
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
    clearAuthCookies(c);
    return c.redirect('/');
  };

  routes.get('/logout', handleLogout);
  routes.post('/logout', handleLogout);

  // --- DATA ENDPOINTS ---
  routes.get("/data", async (c) => {
    try {
      const user = requireAuth(c);
      const userDO = getUserDO(c, user.email);
      const result = await userDO.get('data');
      const response: DataResponse = { ok: true, data: result };
      return c.json(response);
    } catch (e: any) {
      const { errorResponse } = handleError(e, "Unauthorized");
      return c.json(errorResponse, 401);
    }
  });

  routes.post("/data", async (c) => {
    try {
      const user = requireAuth(c);
      const { key, value } = await parseBody(c, SetDataRequestSchema);

      const userDO = getUserDO(c, user.email);
      const result = await userDO.set(key, value);
      if (!result.ok) {
        throw new Error('Failed to set data');
      }

      // Broadcast WebSocket notification for data changes
      console.log(`🔥 Data changed for ${user.email}: ${key} = ${JSON.stringify(value)}`);
      broadcastToUser(user.email, {
        event: `kv:${key}`,
        data: { key, value },
        timestamp: Date.now()
      }, 'USERDO', c.env);

      const response: DataResponse = { ok: true, data: { key, value } };
      return c.json(response);
    } catch (e: any) {
      const { errorResponse, status } = handleError(e, 'Invalid data format');
      return c.json(errorResponse, status);
    }
  });

  routes.get('/protected/profile', (c) => {
    try {
      const user = requireAuth(c);
      return c.json({ ok: true, user });
    } catch (e: any) {
      const { errorResponse } = handleError(e, "Unauthorized");
      return c.json(errorResponse, 401);
    }
  });

  // --- ORGANIZATION ENDPOINTS ---
  routes.post('/api/organizations', async (c) => {
    try {
      const user = requireAuth(c);
      const { name } = await parseBody(c, { parse: (data: any) => ({ name: data.name }) });

      if (!name) {
        throw new Error('Organization name is required');
      }

      const userDO = getUserDO(c, user.email);
      const result = await userDO.createOrganization(name);

      const contentType = c.req.header('content-type') || '';
      if (contentType.includes('application/json')) {
        return c.json(result);
      } else {
        return c.redirect('/organizations');
      }
    } catch (e: any) {
      const { errorResponse, status } = handleError(e, 'Failed to create organization');
      return c.json(errorResponse, status);
    }
  });

  routes.get('/api/organizations', async (c) => {
    try {
      const user = requireAuth(c);
      const userDO = getUserDO(c, user.email);
      const result = await userDO.getOrganizations();
      return c.json(result);
    } catch (e: any) {
      const { errorResponse, status } = handleError(e, 'Failed to get organizations');
      return c.json(errorResponse, status);
    }
  });

  routes.get('/api/organizations/:id', async (c) => {
    try {
      const user = requireAuth(c);
      const organizationId = c.req.param('id');
      if (!organizationId) {
        throw new Error('Organization ID is required');
      }

      const userDO = getUserDO(c, user.email);
      const result = await userDO.getOrganization(organizationId);
      return c.json(result);
    } catch (e: any) {
      const { errorResponse, status } = handleError(e, 'Failed to get organization');
      return c.json(errorResponse, status);
    }
  });

  routes.post('/api/organizations/:id/members', async (c) => {
    try {
      const user = requireAuth(c);
      const organizationId = c.req.param('id');
      if (!organizationId) {
        throw new Error('Organization ID is required');
      }

      const { email, role = 'member' } = await parseBody(c, {
        parse: (data: any) => ({ email: data.email, role: data.role || 'member' })
      });

      if (!email) {
        throw new Error('Email is required');
      }

      const userDO = getUserDO(c, user.email);
      const result = await userDO.addOrganizationMember(organizationId, email.toLowerCase(), role);

      const contentType = c.req.header('content-type') || '';
      if (contentType.includes('application/json')) {
        return c.json(result);
      } else {
        return c.redirect(`/organizations/${organizationId}`);
      }
    } catch (e: any) {
      const { errorResponse, status } = handleError(e, 'Failed to add member');
      return c.json(errorResponse, status);
    }
  });

  routes.delete('/api/organizations/:id/members/:userId', async (c) => {
    try {
      const user = requireAuth(c);
      const organizationId = c.req.param('id');
      const userId = c.req.param('userId');

      if (!organizationId || !userId) {
        throw new Error('Organization ID and User ID are required');
      }

      const userDO = getUserDO(c, user.email);
      const result = await userDO.removeOrganizationMember(organizationId, userId);
      return c.json(result);
    } catch (e: any) {
      const { errorResponse, status } = handleError(e, 'Failed to remove member');
      return c.json(errorResponse, status);
    }
  });

  routes.get('/api/docs', async (c) => {
    return c.json({
      name: 'UserDO',
      version: '0.1.37',
      status: 'ready',
      endpoints: {
        auth: ['/api/signup', '/api/login', '/api/logout', '/api/me'],
        data: ['/data'],
        organizations: ['/api/organizations', '/api/organizations/:id', '/api/organizations/:id/members'],
        passwordReset: ['/api/password-reset/request', '/api/password-reset/confirm']
      },
      docs: 'https://github.com/acoyfellow/userdo'
    });
  });

  return routes;
}

// --- MAIN EXPORTS ---
export function getUserDOFromContext(c: Context, email: string, bindingName: string = 'USERDO'): UserDO {
  const binding = c.env[bindingName];
  if (!binding) {
    throw new Error(`Durable Object binding '${bindingName}' not found. Make sure it's configured in wrangler.jsonc`);
  }
  const userDOID = binding.idFromName(email);
  return binding.get(userDOID) as unknown as UserDO;
}

export function createUserDOWorker(bindingName: string = 'USERDO') {
  return createRoutes((c, email) => getUserDOFromContext(c, email, bindingName));
}

export function broadcastToUser(email: string, message: any, bindingName: string = 'USERDO', env: any) {
  const binding = env[bindingName];
  if (!binding) {
    console.error(`Durable Object binding '${bindingName}' not found`);
    return;
  }

  const userDOID = binding.idFromName(email);
  const userDO = binding.get(userDOID);

  userDO.broadcast(message.event, message.data).catch((error: any) => {
    console.error('Failed to broadcast to UserDO:', error);
  });
}

export function createWebSocketHandler(bindingName: string = 'USERDO') {
  return {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
      const url = new URL(request.url);

      if (url.pathname === '/api/ws' && request.headers.get('upgrade') === 'websocket') {
        console.log('🔌 WebSocket upgrade request received');

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

        try {
          const parts = token.split('.');
          if (parts.length !== 3) throw new Error('Invalid token format');

          const payload = JSON.parse(atob(parts[1]));
          const email = payload.email?.toLowerCase();

          if (!email) throw new Error('No email in token');

          console.log(`🔌 WebSocket auth successful for: ${email}`);

          const binding = (env as any)[bindingName];
          if (!binding) {
            throw new Error(`Durable Object binding '${bindingName}' not found`);
          }

          const userDOID = binding.idFromName(email);
          const userDO = binding.get(userDOID);

          return userDO.fetch(request);

        } catch (error) {
          console.log('❌ WebSocket auth failed:', error);
          return new Response('Unauthorized', { status: 401 });
        }
      }

      return new Response('Not Found', { status: 404 });
    }
  };
}

// Create main app and export
const app = createRoutes(getUserDOFromContext);

export { UserDO };
export { app as userDOWorker };
export default app;