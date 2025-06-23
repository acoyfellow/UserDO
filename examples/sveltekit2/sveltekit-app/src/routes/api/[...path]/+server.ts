import type { RequestHandler } from './$types';
import { client } from '../../../lib/make-client';

const WORKER_URL = 'http://localhost:8787'; // UserDO worker URL

// Universal proxy that forwards all API requests to the UserDO worker
const handler: RequestHandler = async ({ request, params, cookies }) => {
  const path = params.path;
  const method = request.method;

  console.log(`🔄 Proxy: ${method} /api/${path}`);

  try {
    // Build the target URL
    const targetUrl = `${WORKER_URL}/api/${path}`;

    // Get headers from the original request
    const headers = new Headers();

    // Copy important headers
    const importantHeaders = ['content-type', 'authorization'];
    importantHeaders.forEach(header => {
      const value = request.headers.get(header);
      if (value) {
        headers.set(header, value);
      }
    });

    // Add cookies as headers for authentication
    const sessionToken = cookies.get('session-token');
    if (sessionToken) {
      headers.set('Cookie', `session-token=${sessionToken}`);
    }

    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      headers,
      credentials: 'include',
    };

    // Add body for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      const body = await request.text();
      if (body) {
        requestOptions.body = body;
      }
    }

    console.log(`🎯 Forwarding to: ${targetUrl}`);

    // Make the request to the UserDO worker
    const response = await fetch(targetUrl, requestOptions);

    console.log(`📡 Worker response: ${response.status}`);

    // Get response body
    const responseText = await response.text();
    let responseData;

    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    // Create response with same status and headers
    const proxyResponse = new Response(JSON.stringify(responseData), {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'Content-Type': 'application/json',
        // Copy CORS headers from worker response
        'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin') || '*',
        'Access-Control-Allow-Credentials': 'true',
      }
    });

    // Handle Set-Cookie headers for authentication
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      // Parse and set cookies
      const cookieParts = setCookieHeader.split(';')[0].split('=');
      if (cookieParts.length === 2) {
        const [cookieName, cookieValue] = cookieParts;
        cookies.set(cookieName, cookieValue, {
          path: '/',
          httpOnly: true,
          secure: false, // Set to true in production
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7 // 7 days
        });
      }
    }

    console.log(`✅ Proxy response: ${response.status}`);
    return proxyResponse;

  } catch (error) {
    console.error(`❌ Proxy error for ${method} /api/${path}:`, error);

    return new Response(JSON.stringify({
      error: 'Proxy error',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
export const OPTIONS = handler; 