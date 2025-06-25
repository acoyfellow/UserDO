import { Hono, Context } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { createAuthMiddleware } from './authMiddleware'
import { UserDO, type Env, hashEmailForId } from './UserDO'
import {
  SignupRequestSchema,
  LoginRequestSchema,
  PasswordResetRequestSchema,
  PasswordResetConfirmSchema,
  SetDataRequestSchema,
  CreateOrganizationRequestSchema,
  AddMemberRequestSchema,
  UpdateMemberRoleRequestSchema,
  RemoveMemberRequestSchema,
  type UserDOEndpoints,
  type AuthResponse,
  type ErrorResponse,
  type SuccessResponse,
  type DataResponse,
  type OrganizationsResponse,
  type MemberOrganizationsResponse,
  type OrganizationResponse,
} from './worker-types'

type User = {
  id: string;
  email: string;
}

const isRequestSecure = (c: Context) => new URL(c.req.url).protocol === 'https:';

const app = new Hono<{ Bindings: Env, Variables: { user: User } }>()

// --- CLEAN AUTH MIDDLEWARE ---
app.use('/*', createAuthMiddleware((c, email) => getUserDOFromContext(c, email)));

// --- JSON AUTH ENDPOINTS (for client) ---
app.post('/api/signup', async (c): Promise<Response> => {
  try {
    const body = await c.req.json();
    const { email, password } = SignupRequestSchema.parse(body);

    const userDO = await getUserDOFromContext(c, email.toLowerCase());
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

    const userDO = await getUserDOFromContext(c, email.toLowerCase());
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
        const userDO = await getUserDOFromContext(c, email);
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

    const userDO = await getUserDOFromContext(c, email.toLowerCase());
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

    const userDO = await getUserDOFromContext(c, email);
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

// --- ORGANIZATION ENDPOINTS ---

// Create organization
app.post('/api/organizations', async (c): Promise<Response> => {
  try {
    const user = c.get('user');
    if (!user) {
      const errorResponse: ErrorResponse = { error: 'Unauthorized' };
      return c.json(errorResponse, 401);
    }

    const body = await c.req.json();
    const { name } = CreateOrganizationRequestSchema.parse(body);

    const userDO = await getUserDOFromContext(c, user.email);
    const result = await userDO.createOrganization({ name });

    return c.json(result);
  } catch (e: any) {
    const errorResponse: ErrorResponse = { error: e.message || "Failed to create organization" };
    return c.json(errorResponse, 400);
  }
});

// Get user's owned organizations
app.get('/api/organizations', async (c): Promise<Response> => {
  try {
    const user = c.get('user');
    if (!user) {
      const errorResponse: ErrorResponse = { error: 'Unauthorized' };
      return c.json(errorResponse, 401);
    }

    const userDO = await getUserDOFromContext(c, user.email);
    const result = await userDO.getOrganizations();

    const response: OrganizationsResponse = result;
    return c.json(response);
  } catch (e: any) {
    const errorResponse: ErrorResponse = { error: e.message || "Failed to get organizations" };
    return c.json(errorResponse, 400);
  }
});

// Get organizations where user is a member
app.get('/api/organizations/member', async (c): Promise<Response> => {
  try {
    const user = c.get('user');
    if (!user) {
      const errorResponse: ErrorResponse = { error: 'Unauthorized' };
      return c.json(errorResponse, 401);
    }

    const userDO = await getUserDOFromContext(c, user.email);
    const result = await userDO.getMemberOrganizations();

    const response: MemberOrganizationsResponse = result;
    return c.json(response);
  } catch (e: any) {
    const errorResponse: ErrorResponse = { error: e.message || "Failed to get member organizations" };
    return c.json(errorResponse, 400);
  }
});

// Get specific organization
app.get('/api/organizations/:id', async (c): Promise<Response> => {
  try {
    const user = c.get('user');
    if (!user) {
      const errorResponse: ErrorResponse = { error: 'Unauthorized' };
      return c.json(errorResponse, 401);
    }

    const organizationId = c.req.param('id');
    if (!organizationId) {
      const errorResponse: ErrorResponse = { error: 'Organization ID required' };
      return c.json(errorResponse, 400);
    }

    const userDO = await getUserDOFromContext(c, user.email);
    const result = await userDO.getOrganization({ organizationId });

    return c.json(result);
  } catch (e: any) {
    const errorResponse: ErrorResponse = { error: e.message || "Failed to get organization" };
    return c.json(errorResponse, 400);
  }
});

// Add member to organization
app.post('/api/organizations/members', async (c): Promise<Response> => {
  try {
    const user = c.get('user');
    if (!user) {
      const errorResponse: ErrorResponse = { error: 'Unauthorized' };
      return c.json(errorResponse, 401);
    }

    const body = await c.req.json();
    const { organizationId, email, role } = AddMemberRequestSchema.parse(body);

    const userDO = await getUserDOFromContext(c, user.email);
    await userDO.addMemberToOrganization({ organizationId, email, role });

    const response: SuccessResponse = { ok: true };
    return c.json(response);
  } catch (e: any) {
    const errorResponse: ErrorResponse = { error: e.message || "Failed to add member" };
    return c.json(errorResponse, 400);
  }
});

// Remove member from organization
app.delete('/api/organizations/members', async (c): Promise<Response> => {
  try {
    const user = c.get('user');
    if (!user) {
      const errorResponse: ErrorResponse = { error: 'Unauthorized' };
      return c.json(errorResponse, 401);
    }

    const body = await c.req.json();
    const { organizationId, email } = RemoveMemberRequestSchema.parse(body);

    const userDO = await getUserDOFromContext(c, user.email);
    await userDO.removeMemberFromOrganization({ organizationId, email });

    const response: SuccessResponse = { ok: true };
    return c.json(response);
  } catch (e: any) {
    const errorResponse: ErrorResponse = { error: e.message || "Failed to remove member" };
    return c.json(errorResponse, 400);
  }
});

// Update member role
app.put('/api/organizations/members/role', async (c): Promise<Response> => {
  try {
    const user = c.get('user');
    if (!user) {
      const errorResponse: ErrorResponse = { error: 'Unauthorized' };
      return c.json(errorResponse, 401);
    }

    const body = await c.req.json();
    const { organizationId, email, role } = UpdateMemberRoleRequestSchema.parse(body);

    const userDO = await getUserDOFromContext(c, user.email);
    await userDO.updateMemberRole({ organizationId, email, role });

    const response: SuccessResponse = { ok: true };
    return c.json(response);
  } catch (e: any) {
    const errorResponse: ErrorResponse = { error: e.message || "Failed to update member role" };
    return c.json(errorResponse, 400);
  }
});

// --- FORM AUTH ENDPOINTS (for server-side forms) ---
app.post('/signup', async (c) => {
  const formData = await c.req.formData()
  const email = (formData.get('email') as string)?.toLowerCase();
  const password = formData.get('password') as string
  if (!email || !password) {
    return c.json({ error: "Missing fields" }, 400)
  }
  const userDO = await getUserDOFromContext(c, email);
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
  const userDO = await getUserDOFromContext(c, email);
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
        const userDO = await getUserDOFromContext(c, email);
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
  const userDO = await getUserDOFromContext(c, user.email);
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

    const userDO = await getUserDOFromContext(c, user.email);
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


// Export utilities for extending the worker
export async function getUserDOFromContext(c: Context, email: string, bindingName: string = 'USERDO'): Promise<UserDO> {
  // Use the specified binding name, defaulting to USERDO for backwards compatibility
  const binding = c.env[bindingName];
  if (!binding) {
    throw new Error(`Durable Object binding '${bindingName}' not found. Make sure it's configured in wrangler.jsonc`);
  }
  // CRITICAL FIX: Use hashed email like getUserDO does to ensure same UserDO instance
  const hashedEmail = await hashEmailForId(email.toLowerCase());
  const userDOID = binding.idFromName(hashedEmail);
  return binding.get(userDOID) as unknown as UserDO;
}
export function createUserDOWorker(bindingName: string = 'USERDO') {
  const app = new Hono<{ Bindings: Env, Variables: { user: User } }>();

  // Helper function that uses the specified binding name
  const getUserDO = async (c: Context, email: string) => await getUserDOFromContext(c, email, bindingName);

  // Auth middleware - same clean version as main worker
  app.use('*', createAuthMiddleware(getUserDO, 'createUserDOWorker'));

  // Copy all the routes from the main app but use the custom getUserDO function
  // API endpoints
  app.post('/api/signup', async (c) => {
    try {
      const body = await c.req.json();
      const { email, password } = SignupRequestSchema.parse(body);
      const userDO = await getUserDO(c, email.toLowerCase());
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
      const userDO = await getUserDO(c, email.toLowerCase());
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
        const userDO = await getUserDO(c, user.email);
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
      const userDO = await getUserDO(c, email.toLowerCase());
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

      const userDO = await getUserDO(c, email);
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
    const userDO = await getUserDO(c, email);
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
    const userDO = await getUserDO(c, email);
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
          const userDO = await getUserDO(c, email);
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
    const userDO = await getUserDO(c, user.email);
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

      const userDO = await getUserDO(c, user.email);
      const result = await userDO.set(validKey, validValue);
      if (!result.ok) {
        const errorResponse: ErrorResponse = { error: 'Failed to set data' };
        return c.json(errorResponse, 400);
      }

      // Broadcast WebSocket notification for data changes
      console.log(`🔥 Data changed for ${user.email}: ${validKey} = ${JSON.stringify(validValue)}`);
      broadcastToUser(user.email, {
        event: `kv:${validKey}`,
        data: { key: validKey, value: validValue },
        timestamp: Date.now()
      }, bindingName, c.env);

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

  // Note: Generic collection endpoints removed - apps should implement specific routes
  // like /api/posts, /api/comments, etc. for proper database integration

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

// Helper to broadcast to user's WebSocket connections via UserDO
export function broadcastToUser(email: string, message: any, bindingName: string = 'USERDO', env: any) {
  // Get the UserDO and call its broadcast method
  const binding = env[bindingName];
  if (!binding) {
    console.error(`Durable Object binding '${bindingName}' not found`);
    return;
  }

  const userDOID = binding.idFromName(email);
  const userDO = binding.get(userDOID);

  // Call the UserDO's broadcast method (this will be async but we don't await it)
  userDO.broadcast(message.event, message.data).catch((error: any) => {
    console.error('Failed to broadcast to UserDO:', error);
  });
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

          // Delegate WebSocket handling to the UserDO using hibernation API
          const binding = (env as any)[bindingName];
          if (!binding) {
            throw new Error(`Durable Object binding '${bindingName}' not found`);
          }

          const userDOID = binding.idFromName(email);
          const userDO = binding.get(userDOID);

          // Forward the WebSocket upgrade request to the UserDO
          return userDO.fetch(request);

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