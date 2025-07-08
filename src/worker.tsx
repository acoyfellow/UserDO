import { Hono, Context } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { createAuthMiddleware } from './authMiddleware'
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

// Shared logout handler to avoid duplication
const handleLogout = (getUserDO: (c: Context, email: string) => UserDO) => async (c: Context) => {
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
};

const app = new Hono<{ Bindings: Env, Variables: { user: User } }>()

// --- CLEAN AUTH MIDDLEWARE ---
app.use('/*', createAuthMiddleware((c, email) => getUserDOFromContext(c, email)));

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

// logout - both GET and POST for convenience
app.get('/logout', handleLogout(getUserDOFromContext));
app.post('/logout', handleLogout(getUserDOFromContext));

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

// --- ORGANIZATION ENDPOINTS ---

// Create organization
app.post('/api/organizations', async (c): Promise<Response> => {
  try {
    const user = c.get('user');
    if (!user) {
      const errorResponse: ErrorResponse = { error: 'Unauthorized' };
      return c.json(errorResponse, 401);
    }

    let name: string;
    const contentType = c.req.header('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await c.req.json();
      name = body.name;
    } else {
      const formData = await c.req.formData();
      name = formData.get('name') as string;
    }

    if (!name) {
      const errorResponse: ErrorResponse = { error: 'Organization name is required' };
      return c.json(errorResponse, 400);
    }

    const userDO = getUserDOFromContext(c, user.email);
    const result = await userDO.createOrganization(name);

    if (contentType.includes('application/json')) {
      return c.json(result);
    } else {
      return c.redirect('/organizations');
    }
  } catch (e: any) {
    const errorResponse: ErrorResponse = { error: e.message || 'Failed to create organization' };
    return c.json(errorResponse, 400);
  }
});

// Get user's organizations
app.get('/api/organizations', async (c): Promise<Response> => {
  try {
    const user = c.get('user');
    if (!user) {
      const errorResponse: ErrorResponse = { error: 'Unauthorized' };
      return c.json(errorResponse, 401);
    }

    const userDO = getUserDOFromContext(c, user.email);
    const result = await userDO.getOrganizations();
    return c.json(result);
  } catch (e: any) {
    const errorResponse: ErrorResponse = { error: e.message || 'Failed to get organizations' };
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
      const errorResponse: ErrorResponse = { error: 'Organization ID is required' };
      return c.json(errorResponse, 400);
    }

    const userDO = getUserDOFromContext(c, user.email);
    const result = await userDO.getOrganization(organizationId);
    return c.json(result);
  } catch (e: any) {
    const errorResponse: ErrorResponse = { error: e.message || 'Failed to get organization' };
    return c.json(errorResponse, 400);
  }
});

// Add member to organization
app.post('/api/organizations/:id/members', async (c): Promise<Response> => {
  try {
    const user = c.get('user');
    if (!user) {
      const errorResponse: ErrorResponse = { error: 'Unauthorized' };
      return c.json(errorResponse, 401);
    }

    const organizationId = c.req.param('id');
    if (!organizationId) {
      const errorResponse: ErrorResponse = { error: 'Organization ID is required' };
      return c.json(errorResponse, 400);
    }

    let email: string, role: 'admin' | 'member';
    const contentType = c.req.header('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await c.req.json();
      email = body.email;
      role = body.role || 'member';
    } else {
      const formData = await c.req.formData();
      email = formData.get('email') as string;
      role = (formData.get('role') as 'admin' | 'member') || 'member';
    }

    if (!email) {
      const errorResponse: ErrorResponse = { error: 'Email is required' };
      return c.json(errorResponse, 400);
    }

    const userDO = getUserDOFromContext(c, user.email);
    const result = await userDO.addOrganizationMember(organizationId, email.toLowerCase(), role);

    if (contentType.includes('application/json')) {
      return c.json(result);
    } else {
      return c.redirect(`/organizations/${organizationId}`);
    }
  } catch (e: any) {
    const errorResponse: ErrorResponse = { error: e.message || 'Failed to add member' };
    return c.json(errorResponse, 400);
  }
});

// Remove member from organization
app.delete('/api/organizations/:id/members/:userId', async (c): Promise<Response> => {
  try {
    const user = c.get('user');
    if (!user) {
      const errorResponse: ErrorResponse = { error: 'Unauthorized' };
      return c.json(errorResponse, 401);
    }

    const organizationId = c.req.param('id');
    const userId = c.req.param('userId');

    if (!organizationId || !userId) {
      const errorResponse: ErrorResponse = { error: 'Organization ID and User ID are required' };
      return c.json(errorResponse, 400);
    }

    const userDO = getUserDOFromContext(c, user.email);
    const result = await userDO.removeOrganizationMember(organizationId, userId);
    return c.json(result);
  } catch (e: any) {
    const errorResponse: ErrorResponse = { error: e.message || 'Failed to remove member' };
    return c.json(errorResponse, 400);
  }
});


// Export utilities for extending the worker
export function getUserDOFromContext(c: Context, email: string, bindingName: string = 'USERDO'): UserDO {
  // Use the specified binding name, defaulting to USERDO for backwards compatibility
  const binding = c.env[bindingName];
  if (!binding) {
    const availableBindings = Object.keys(c.env)
      .filter(k => {
        const b = (c.env as any)[k];
        return b && typeof b === 'object' && 'get' in b && 'idFromName' in b;
      })
      .join(', ');
    throw new Error(
      `❌ UserDO Configuration Error: Durable Object binding '${bindingName}' not found.\n\n` +
      `Required: add this binding to your worker configuration:\nbindings: { ${bindingName}: yourDurableObjectNamespace }\n\n` +
      `Available Durable Object bindings: ${availableBindings}`
    );
  }
  const userDOID = binding.idFromName(email);
  return binding.get(userDOID) as unknown as UserDO;
}
export function createUserDOWorker(bindingName: string = 'USERDO') {
  const app = new Hono<{ Bindings: Env, Variables: { user: User } }>();

  // Helper function that uses the specified binding name
  const getUserDO = (c: Context, email: string) => getUserDOFromContext(c, email, bindingName);

  // Auth middleware - same clean version as main worker
  app.use('*', createAuthMiddleware(getUserDO, 'createUserDOWorker'));

  // Diagnostic endpoint to verify Durable Object binding configuration
  app.get('/api/userdo/status', (c) => {
    const binding = c.env[bindingName];
    const availableBindings = Object.keys(c.env).filter(k => {
      const b = (c.env as any)[k];
      return b && typeof b === 'object' && 'get' in b && 'idFromName' in b;
    });

    return c.json({
      package: 'UserDO',
      bindingName,
      bindingExists: !!binding,
      status: binding ? 'ready' : 'misconfigured',
      availableBindings,
      message: binding
        ? `✅ UserDO ready with binding '${bindingName}'`
        : `❌ Binding '${bindingName}' not found. Available DO bindings: ${availableBindings.join(', ')}`
    });
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

  // logout - both GET and POST for convenience
  app.get('/logout', handleLogout(getUserDO));
  app.post('/logout', handleLogout(getUserDO));

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

  // --- ORGANIZATION ENDPOINTS ---

  // Create organization
  app.post('/api/organizations', async (c) => {
    try {
      const user = c.get('user');
      if (!user) {
        const errorResponse: ErrorResponse = { error: 'Unauthorized' };
        return c.json(errorResponse, 401);
      }

      let name: string;
      const contentType = c.req.header('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await c.req.json();
        name = body.name;
      } else {
        const formData = await c.req.formData();
        name = formData.get('name') as string;
      }

      if (!name) {
        const errorResponse: ErrorResponse = { error: 'Organization name is required' };
        return c.json(errorResponse, 400);
      }

      const userDO = getUserDO(c, user.email);
      const result = await userDO.createOrganization(name);

      if (contentType.includes('application/json')) {
        return c.json(result);
      } else {
        return c.redirect('/organizations');
      }
    } catch (e: any) {
      const errorResponse: ErrorResponse = { error: e.message || 'Failed to create organization' };
      return c.json(errorResponse, 400);
    }
  });

  // Get user's organizations
  app.get('/api/organizations', async (c) => {
    try {
      const user = c.get('user');
      if (!user) {
        const errorResponse: ErrorResponse = { error: 'Unauthorized' };
        return c.json(errorResponse, 401);
      }

      const userDO = getUserDO(c, user.email);
      const result = await userDO.getOrganizations();
      return c.json(result);
    } catch (e: any) {
      const errorResponse: ErrorResponse = { error: e.message || 'Failed to get organizations' };
      return c.json(errorResponse, 400);
    }
  });

  // Get specific organization
  app.get('/api/organizations/:id', async (c) => {
    try {
      const user = c.get('user');
      if (!user) {
        const errorResponse: ErrorResponse = { error: 'Unauthorized' };
        return c.json(errorResponse, 401);
      }

      const organizationId = c.req.param('id');
      if (!organizationId) {
        const errorResponse: ErrorResponse = { error: 'Organization ID is required' };
        return c.json(errorResponse, 400);
      }

      const userDO = getUserDO(c, user.email);
      const result = await userDO.getOrganization(organizationId);
      return c.json(result);
    } catch (e: any) {
      const errorResponse: ErrorResponse = { error: e.message || 'Failed to get organization' };
      return c.json(errorResponse, 400);
    }
  });

  // Add member to organization
  app.post('/api/organizations/:id/members', async (c) => {
    try {
      const user = c.get('user');
      if (!user) {
        const errorResponse: ErrorResponse = { error: 'Unauthorized' };
        return c.json(errorResponse, 401);
      }

      const organizationId = c.req.param('id');
      if (!organizationId) {
        const errorResponse: ErrorResponse = { error: 'Organization ID is required' };
        return c.json(errorResponse, 400);
      }

      let email: string, role: 'admin' | 'member';
      const contentType = c.req.header('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await c.req.json();
        email = body.email;
        role = body.role || 'member';
      } else {
        const formData = await c.req.formData();
        email = formData.get('email') as string;
        role = (formData.get('role') as 'admin' | 'member') || 'member';
      }

      if (!email) {
        const errorResponse: ErrorResponse = { error: 'Email is required' };
        return c.json(errorResponse, 400);
      }

      const userDO = getUserDO(c, user.email);
      const result = await userDO.addOrganizationMember(organizationId, email.toLowerCase(), role);

      if (contentType.includes('application/json')) {
        return c.json(result);
      } else {
        return c.redirect(`/organizations/${organizationId}`);
      }
    } catch (e: any) {
      const errorResponse: ErrorResponse = { error: e.message || 'Failed to add member' };
      return c.json(errorResponse, 400);
    }
  });

  // Remove member from organization
  app.delete('/api/organizations/:id/members/:userId', async (c) => {
    try {
      const user = c.get('user');
      if (!user) {
        const errorResponse: ErrorResponse = { error: 'Unauthorized' };
        return c.json(errorResponse, 401);
      }

      const organizationId = c.req.param('id');
      const userId = c.req.param('userId');

      if (!organizationId || !userId) {
        const errorResponse: ErrorResponse = { error: 'Organization ID and User ID are required' };
        return c.json(errorResponse, 400);
      }

      const userDO = getUserDO(c, user.email);
      const result = await userDO.removeOrganizationMember(organizationId, userId);
      return c.json(result);
    } catch (e: any) {
      const errorResponse: ErrorResponse = { error: e.message || 'Failed to remove member' };
      return c.json(errorResponse, 400);
    }
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
        organizations: ['/api/organizations', '/api/organizations/:id', '/api/organizations/:id/members'],
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