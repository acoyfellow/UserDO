import { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { Env } from './UserDO'
import { UserDO } from './UserDO'
export { UserDO }

type User = {
  id: string;
  email: string;
}

const app = new Hono<{ Bindings: Env, Variables: { user: User } }>()

// --- AUTH ENDPOINTS ---
app.post('/signup', async (c) => {
  const formData = await c.req.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  if (!email || !password) {
    return c.json({ error: "Missing fields" }, 400)
  }
  const userDOID = c.env.USERDO.idFromName(email);
  const userDO = c.env.USERDO.get(userDOID) as unknown as UserDO;
  try {
    const { user, token } = await userDO.signup({ email, password })
    setCookie(c, 'token', token, {
      httpOnly: true,
      secure: true,
      path: '/',
      sameSite: 'Strict'
    })
    return c.json({ ok: true, user: { id: user.id, email: user.email } })
  } catch (e: any) {
    return c.json({ error: e.message || "Signup error" }, 400)
  }
})

app.post('/login', async (c) => {
  const formData = await c.req.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  if (!email || !password) {
    return c.json({ error: "Missing fields" }, 400)
  }
  const userDOID = c.env.USERDO.idFromName(email);
  const userDO = c.env.USERDO.get(userDOID) as unknown as UserDO;
  try {
    const { user, token } = await userDO.login({ email, password })
    setCookie(c, 'token', token, {
      httpOnly: true,
      secure: true,
      path: '/',
      sameSite: 'Strict'
    })
    return c.json({ ok: true, user: { id: user.id, email: user.email } })
  } catch (e: any) {
    return c.json({ error: e.message || "Login error" }, 400)
  }
})

// --- AUTH MIDDLEWARE ---
app.use('/*', async (c, next) => {
  try {
    const token = getCookie(c, 'token') || '';
    const payload = JSON.parse(atob(token.split('.')[1]));
    console.log(payload);
    let email = payload.email;
    const userDOID = c.env.USERDO.idFromName(email);
    const userDO = c.env.USERDO.get(userDOID) as unknown as UserDO;
    const result = await userDO.verifyToken({ token });
    if (result.ok && result.user) {
      c.set('user', result.user);
      await next();
    };
  } catch (e) {
    next();
  };

});

// Example protected endpoint
app.get('/protected/profile', (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  return c.json({ ok: true, user });
});

// --- Minimal Frontend (JSX) ---
app.get('/', async (c) => {
  const user = c.get('user');

  return c.html(
    <html>
      <body>
        <h1>UserDO Demo</h1>
        <form method="post" action="/signup">
          <input name="email" type="email" placeholder="Email" required />
          <input name="password" type="password" placeholder="Password" required />
          <button type="submit">Sign Up</button>
        </form>
        <form method="post" action="/login">
          <input name="email" type="email" placeholder="Email" required />
          <input name="password" type="password" placeholder="Password" required />
          <button type="submit">Login</button>
        </form>
        <a href="/protected/profile">View Profile (protected)</a>
        <pre>{JSON.stringify(user, null, 2)}</pre>
      </body>
    </html>
  )
})

export default app
