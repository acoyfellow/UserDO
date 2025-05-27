import { jsx as _jsx, jsxs as _jsxs } from "hono/jsx/jsx-runtime";
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { UserDO } from '../../src/UserDO';
export { UserDO };
const getUserDO = (c, email) => {
    const userDOID = c.env.USERDO.idFromName(email);
    return c.env.USERDO.get(userDOID);
};
const app = new Hono();
// --- AUTH ENDPOINTS ---
app.post('/signup', async (c) => {
    const formData = await c.req.formData();
    const email = formData.get('email')?.toLowerCase();
    const password = formData.get('password');
    if (!email || !password) {
        return c.json({ error: "Missing fields" }, 400);
    }
    const userDO = getUserDO(c, email);
    try {
        const { user, token, refreshToken } = await userDO.signup({ email, password });
        setCookie(c, 'token', token, {
            httpOnly: true,
            secure: true,
            path: '/',
            sameSite: 'Strict'
        });
        setCookie(c, 'refreshToken', refreshToken, {
            httpOnly: true,
            secure: true,
            path: '/',
            sameSite: 'Strict'
        });
        return c.redirect('/');
    }
    catch (e) {
        return c.json({ error: e.message || "Signup error" }, 400);
    }
});
app.post('/login', async (c) => {
    const formData = await c.req.formData();
    const email = formData.get('email')?.toLowerCase();
    const password = formData.get('password');
    if (!email || !password) {
        return c.json({ error: "Missing fields" }, 400);
    }
    const userDO = getUserDO(c, email);
    try {
        const { user, token, refreshToken } = await userDO.login({ email, password });
        setCookie(c, 'token', token, {
            httpOnly: true,
            secure: true,
            path: '/',
            sameSite: 'Strict'
        });
        setCookie(c, 'refreshToken', refreshToken, {
            httpOnly: true,
            secure: true,
            path: '/',
            sameSite: 'Strict'
        });
        return c.redirect('/');
    }
    catch (e) {
        return c.json({ error: e.message || "Login error" }, 400);
    }
});
// logout
app.post('/logout', async (c) => {
    deleteCookie(c, 'token');
    deleteCookie(c, 'refreshToken');
    return c.redirect('/');
});
// --- AUTH MIDDLEWARE ---
app.use('/*', async (c, next) => {
    try {
        const token = getCookie(c, 'token') || '';
        const refreshToken = getCookie(c, 'refreshToken') || '';
        const accessPayload = JSON.parse(atob(token.split('.')[1]));
        const refreshPayload = JSON.parse(atob(refreshToken.split('.')[1]));
        let email = accessPayload.email?.toLowerCase() || refreshPayload.email?.toLowerCase();
        const userDO = getUserDO(c, email);
        const result = await userDO.verifyToken({ token: token });
        if (!result.ok) {
            const refreshResult = await userDO.refreshToken({ refreshToken });
            if (!refreshResult.token)
                return c.json({ error: 'Unauthorized' }, 401);
            setCookie(c, 'token', refreshResult.token, {
                httpOnly: true,
                secure: true,
                path: '/',
                sameSite: 'Strict'
            });
        }
        if (result.ok && result.user) {
            c.set('user', result.user ?? undefined);
        }
        ;
        await next();
    }
    catch (e) {
        console.error(e);
        await next();
    }
    ;
});
app.get("/data", async (c) => {
    const user = c.get('user');
    if (!user)
        return c.json({ error: 'Unauthorized' }, 401);
    const userDO = getUserDO(c, user.email);
    const result = await userDO.get('data');
    return c.json({ ok: true, data: result.value });
});
app.post("/data", async (c) => {
    const user = c.get('user');
    if (!user)
        return c.json({ error: 'Unauthorized' }, 401);
    const formData = await c.req.formData();
    const key = formData.get('key');
    const value = formData.get('value');
    const userDO = getUserDO(c, user.email);
    const result = await userDO.set(key, value);
    if (!result.ok)
        return c.json({ error: 'Failed to set data' }, 400);
    return c.json({ ok: true, data: { key, value } });
});
// Example protected endpoint
app.get('/protected/profile', (c) => {
    const user = c.get('user');
    if (!user)
        return c.json({ error: 'Unauthorized' }, 401);
    return c.json({ ok: true, user });
});
// --- Minimal Frontend (JSX) ---
app.get('/', async (c) => {
    const user = c.get('user') || undefined;
    const userDO = getUserDO(c, user?.email || '');
    const data = await userDO.get("data");
    return c.html(_jsxs("html", { children: [_jsxs("head", { children: [_jsx("title", { children: "UserDO Demo" }), _jsx("style", { children: `
          body {
            font-family: Avenir, Inter, Helvetica, Arial, sans-serif;
          }
        ` }), _jsx("meta", { name: "viewport", content: "width=device-width, initial-scale=1.0" })] }), _jsxs("body", { children: [_jsx("h1", { children: "UserDO Demo" }), _jsx("a", { href: "https://github.com/acoyfellow/userdo", children: "GitHub" }), "\u00A0\u2022\u00A0", _jsx("a", { href: "https://www.npmjs.com/package/userdo", children: "NPM" }), "\u00A0\u2022\u00A0", _jsx("a", { href: "https://x.com/acoyfellow.com", children: "@acoyfellow" }), !user && _jsxs("section", { children: [_jsx("form", { method: "post", action: "/signup", children: _jsxs("fieldset", { children: [_jsx("legend", { children: _jsx("h2", { children: "Sign Up" }) }), _jsx("label", { for: "signup-email", children: "Email:" }), _jsx("input", { id: "signup-email", name: "email", type: "email", placeholder: "Email", required: true }), _jsx("br", {}), _jsx("label", { for: "signup-password", children: "Password:" }), _jsx("input", { id: "signup-password", name: "password", type: "password", placeholder: "Password", required: true }), _jsx("br", {}), _jsx("button", { type: "submit", children: "Sign Up" })] }) }), _jsx("form", { method: "post", action: "/login", children: _jsxs("fieldset", { children: [_jsx("legend", { children: _jsx("h2", { children: "Login" }) }), _jsx("label", { for: "login-email", children: "Email:" }), _jsx("input", { id: "login-email", name: "email", type: "email", placeholder: "Email", required: true }), _jsx("br", {}), _jsx("label", { for: "login-password", children: "Password:" }), _jsx("input", { id: "login-password", name: "password", type: "password", placeholder: "Password", required: true }), _jsx("br", {}), _jsx("button", { type: "submit", children: "Login" })] }) })] }), user && _jsxs("section", { children: [_jsxs("h2", { children: ["Welcome ", user.email] }), _jsx("form", { method: "post", action: "/logout", children: _jsx("button", { type: "submit", children: "Logout" }) }), _jsx("a", { href: "/protected/profile", children: "View Profile (protected)" }), _jsx("br", {}), _jsx("br", {}), _jsxs("details", { open: true, children: [_jsx("summary", { children: "User Info" }), _jsx("pre", { children: JSON.stringify(user, null, 2) })] }), _jsx("form", { method: "post", action: "/data", children: _jsxs("fieldset", { children: [_jsx("legend", { children: _jsx("h2", { children: "Set Data" }) }), _jsx("label", { for: "data-key", children: "Key:" }), _jsx("input", { id: "data-key", name: "key", type: "text", placeholder: "Key", value: "data", readonly: true, required: true }), _jsx("br", {}), _jsx("label", { for: "data-value", children: "Value:" }), _jsx("input", { id: "data-value", name: "value", type: "text", placeholder: "Value", required: true }), _jsx("br", {}), _jsx("button", { type: "submit", children: "Set Data" }), _jsx("hr", {}), data && (_jsxs("details", { open: true, children: [_jsx("summary", { children: "Data" }), _jsx("pre", { children: JSON.stringify(data, null, 2) })] }))] }) })] })] })] }));
});
export default app;
