import jwt from '@tsndr/cloudflare-worker-jwt';

// JWT payload type matching the UserDO internal implementation
export type JwtPayload = {
  sub: string;
  email?: string; // Optional for refresh tokens
  exp?: number;
  iat?: number;
  type?: string; // For refresh tokens, password reset tokens, etc.
};

/**
 * Simple JWT decoding without verification
 * @param token - JWT token to decode
 * @returns Decoded payload or null if invalid
 */
export function decodeJWT(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    return payload as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * JWT verification with secret - extracted from UserDO implementation
 * @param token - JWT token to verify
 * @param secret - JWT secret for verification
 * @returns Verification result with payload if valid
 */
export async function verifyJWT(token: string, secret: string): Promise<{
  ok: boolean;
  payload?: JwtPayload;
  error?: string;
}> {
  try {
    const isValid = await jwt.verify(token, secret);
    if (!isValid) {
      return { ok: false, error: 'Invalid token' };
    }

    const decoded = jwt.decode(token);
    if (!decoded || !decoded.payload) {
      return { ok: false, error: 'Invalid token payload' };
    }

    return { ok: true, payload: decoded.payload as JwtPayload };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Token verification failed'
    };
  }
}

/**
 * Hash email for ID generation - matches UserDO internal implementation
 * @param email - Email to hash
 * @returns Promise resolving to hex hash string
 */
export async function hashEmailForId(email: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  const hashHex = Array.from(hashArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return hashHex;
}

/**
 * Check if token is expired
 * @param payload - JWT payload
 * @returns true if token is expired
 */
export function isTokenExpired(payload: JwtPayload): boolean {
  if (!payload.exp) return false;
  return payload.exp < Math.floor(Date.now() / 1000);
}

/**
 * Extract email from token
 * @param token - JWT token
 * @returns Email string or null if not found
 */
export function getEmailFromToken(token: string): string | null {
  const payload = decodeJWT(token);
  return payload?.email?.toLowerCase() || null;
}

/**
 * Sign a JWT token with the given payload and secret
 * @param payload - JWT payload
 * @param secret - JWT secret
 * @returns Promise resolving to signed token
 */
export async function signJWT(payload: JwtPayload, secret: string): Promise<string> {
  return await jwt.sign(payload, secret);
}

/**
 * Generate a UserDO-compatible access token
 * @param userId - User ID
 * @param email - User email
 * @param secret - JWT secret
 * @param expiresInMinutes - Token expiration in minutes (default: 15)
 * @returns Promise resolving to signed access token
 */
export async function generateAccessToken(
  userId: string,
  email: string,
  secret: string,
  expiresInMinutes: number = 15
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + expiresInMinutes * 60;
  return await signJWT({
    sub: userId,
    email: email.toLowerCase(),
    exp
  }, secret);
}

/**
 * Generate a UserDO-compatible refresh token
 * @param userId - User ID
 * @param secret - JWT secret
 * @param expiresInDays - Token expiration in days (default: 7)
 * @returns Promise resolving to signed refresh token
 */
export async function generateRefreshToken(
  userId: string,
  secret: string,
  expiresInDays: number = 7
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + expiresInDays * 24 * 60 * 60;
  return await signJWT({
    sub: userId,
    type: 'refresh',
    exp
  }, secret);
}

/**
 * Verify tokens with automatic refresh - decodes email from expired access token
 * @param token - Current access token (may be expired)
 * @param refreshToken - Refresh token (optional)
 * @param secret - JWT secret
 * @returns Verification result with payload and new token if refreshed
 */
export async function verifyTokens(
  token: string,
  refreshToken: string | undefined,
  secret: string
): Promise<{
  ok: boolean;
  payload?: JwtPayload;
  newToken?: string;
  error?: string;
}> {
  // Try current token first
  const result = await verifyJWT(token, secret);
  if (result.ok && result.payload) {
    return { ok: true, payload: result.payload };
  }

  // If token failed and we have refresh token, try refresh
  if (refreshToken) {
    try {
      // Decode (but don't verify) the expired access token to get email
      const decodedToken = decodeJWT(token);
      const email = decodedToken?.email;

      if (!email) {
        return { ok: false, error: 'Cannot decode email from access token' };
      }

      const refreshResult = await verifyJWT(refreshToken, secret);

      if (refreshResult.ok && refreshResult.payload) {
        // Ensure it's a refresh token
        if (refreshResult.payload.type !== 'refresh') {
          return { ok: false, error: 'Invalid refresh token type' };
        }

        const userId = refreshResult.payload.sub;

        // Generate new access token using decoded email
        const newToken = await generateAccessToken(userId, email, secret);

        return {
          ok: true,
          payload: { sub: userId, email },
          newToken
        };
      }
    } catch (e) {
      return { ok: false, error: 'Token refresh failed' };
    }
  }

  return { ok: false, error: 'Token verification failed' };
}

/**
 * Generate a UserDO-compatible password reset token
 * @param userId - User ID
 * @param email - User email
 * @param secret - JWT secret
 * @param expiresInMinutes - Token expiration in minutes (default: 60)
 * @returns Promise resolving to signed password reset token
 */
export async function generatePasswordResetToken(
  userId: string,
  email: string,
  secret: string,
  expiresInMinutes: number = 60
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + expiresInMinutes * 60;
  return await signJWT({
    sub: userId,
    email: email.toLowerCase(),
    type: 'password_reset',
    exp
  }, secret);
} 