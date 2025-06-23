import type { Handle } from '@sveltejs/kit';

const DO_WORKER_URL = 'http://localhost:8787';

export const handle: Handle = async ({ event, resolve }) => {
  const { url, request, cookies } = event;

  // Handle UserDO API routes directly in the hook (like Better Auth)
  if (url.pathname.startsWith('/api/')) {
    const path = url.pathname.replace('/api/', '');
    const targetUrl = `${DO_WORKER_URL}/api/${path}`;

    console.log(`🔄 API: ${request.method} /api/${path}`);

    try {
      // Forward cookies from SvelteKit to DO worker
      const requestHeaders = Object.fromEntries(request.headers.entries());
      const token = cookies.get('token');
      const refreshToken = cookies.get('refreshToken');

      if (token && refreshToken) {
        requestHeaders['Cookie'] = `token=${token}; refreshToken=${refreshToken}`;
        console.log('🍪 Forwarding auth cookies to DO worker');
      }

      const response = await fetch(targetUrl, {
        method: request.method,
        headers: {
          ...requestHeaders,
          'host': 'localhost:8787'
        },
        body: request.method !== 'GET' && request.method !== 'HEAD'
          ? await request.text()
          : undefined,
      });

      const responseText = await response.text();
      let data;

      try {
        data = JSON.parse(responseText);
      } catch (e) {
        return new Response(responseText, { status: response.status });
      }

      // Handle auth cookie setting for login/signup
      if (response.ok && (path === 'login' || path === 'signup')) {
        console.log('🍪 Processing auth cookies for', path);

        // Get all Set-Cookie headers
        const setCookieHeaders: string[] = [];
        response.headers.forEach((value, key) => {
          if (key.toLowerCase() === 'set-cookie') {
            setCookieHeaders.push(value);
            console.log('🍪 Found Set-Cookie header:', value);
          }
        });

        // Process each cookie with proper options
        for (const cookieHeader of setCookieHeaders) {
          const [nameValue] = cookieHeader.split(';');
          const [name, cookieValue] = nameValue.split('=');
          if (name && cookieValue) {
            console.log(`🍪 Setting cookie: ${name}=${cookieValue.substring(0, 20)}...`);

            // Set cookies with proper options for persistence
            cookies.set(name, cookieValue, {
              path: '/',
              httpOnly: true,
              secure: false, // Set to true in production with HTTPS
              sameSite: 'lax',
              maxAge: 60 * 60 * 24 * 7, // 7 days
              // Force the cookie to be set immediately
              encode: (value) => value
            });
          }
        }

        console.log('✅ Auth cookies processed successfully');
      }

      // Handle logout with redirect (proper SvelteKit way)
      if (response.ok && path === 'logout') {
        console.log('🍪 Clearing auth cookies for logout');

        // Delete cookies with EXACT same options as when they were set
        cookies.delete('token', { path: '/' });
        cookies.delete('refreshToken', { path: '/' });

        console.log('🍪 Auth cookies cleared successfully');

        // Return a redirect response to home page
        // This prevents any race conditions with auth validation
        return new Response(null, {
          status: 302,
          headers: {
            'Location': '/',
            // Ensure cookies are deleted in the browser too
            'Set-Cookie': [
              'token=; Path=/; HttpOnly; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
              'refreshToken=; Path=/; HttpOnly; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
            ].join(', ')
          }
        });
      }

      // Create response with proper headers
      const responseHeaders = new Headers({ 'Content-Type': 'application/json' });

      // If we processed auth cookies, we need to forward the Set-Cookie headers to the browser
      if (response.ok && (path === 'login' || path === 'signup')) {
        response.headers.forEach((value, key) => {
          if (key.toLowerCase() === 'set-cookie') {
            responseHeaders.append('Set-Cookie', value);
            console.log('🍪 Forwarding Set-Cookie header to browser:', value.substring(0, 50) + '...');
          }
        });
      }

      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: responseHeaders
      });
    } catch (error) {
      console.error(`❌ API error:`, error);
      return new Response(JSON.stringify({ error: 'API request failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Auth validation for page routes only
  const token = cookies.get('token');
  const refreshToken = cookies.get('refreshToken');

  console.log('🔍 Page auth validation - cookies found:', {
    hasToken: !!token,
    hasRefreshToken: !!refreshToken,
    tokenValue: token ? `${token.substring(0, 20)}...` : 'none',
    refreshTokenValue: refreshToken ? `${refreshToken.substring(0, 20)}...` : 'none',
    path: url.pathname
  });

  if (token && refreshToken) {
    try {
      console.log('🔍 Validating session with DO worker...');
      const response = await fetch(`${DO_WORKER_URL}/api/me`, {
        headers: {
          'Cookie': `token=${token}; refreshToken=${refreshToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json() as { user: any };
        event.locals.user = data.user;
        console.log('✅ User authenticated:', data.user.email);
      } else {
        console.log('❌ Session validation failed, clearing cookies');
        cookies.delete('token', { path: '/' });
        cookies.delete('refreshToken', { path: '/' });
        event.locals.user = null;
      }
    } catch (error) {
      console.error('❌ Auth validation error:', error);
      event.locals.user = null;
    }
  } else {
    event.locals.user = null;
  }

  return resolve(event);
}; 