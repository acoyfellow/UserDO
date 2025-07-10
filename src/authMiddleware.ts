import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { Context, Next } from 'hono'
import type { UserDO } from './UserDO.js'

const isRequestSecure = (c: Context) => new URL(c.req.url).protocol === 'https:'

export type GetUserDO = (c: Context, email: string) => UserDO

export function createAuthMiddleware(getUserDO: GetUserDO, logPrefix = '') {
  return async (c: Context, next: Next) => {
    const url = new URL(c.req.url)
    const token = getCookie(c, 'token') || ''
    const refreshToken = getCookie(c, 'refreshToken') || ''

    const prefix = logPrefix ? `[${logPrefix}] ` : ''
    console.log(`🔐 ${prefix}Auth check for ${url.pathname}:`, {
      hasToken: !!token,
      hasRefreshToken: !!refreshToken
    })

    if (token || refreshToken) {
      try {
        const decodeJWT = (jwt: string) => {
          try {
            const parts = jwt.split('.')
            return parts.length === 3 ? JSON.parse(atob(parts[1])) : null
          } catch { return null }
        }

        const email =
          decodeJWT(token)?.email?.toLowerCase() ||
          decodeJWT(refreshToken)?.email?.toLowerCase()

        if (email) {
          const userDO = getUserDO(c, email)
          let result = await userDO.verifyToken({ token })
          console.log(`🔑 ${prefix}Token verification for ${email}:`, { success: result.ok })

          if (!result.ok && refreshToken) {
            try {
              console.log(`🔄 ${prefix}Attempting token refresh...`)
              const { token: newToken } = await userDO.refreshToken({ refreshToken })
              setCookie(c, 'token', newToken, {
                httpOnly: true,
                secure: isRequestSecure(c),
                path: '/',
                sameSite: 'Lax'
              })
              result = await userDO.verifyToken({ token: newToken })
              console.log(`✅ ${prefix}Token refreshed successfully`)
            } catch (e) {
              console.log(`❌ ${prefix}Token refresh failed:`, e)
              deleteCookie(c, 'token')
              deleteCookie(c, 'refreshToken')
            }
          }

          if (result.ok && result.user) {
            console.log(`👤 ${prefix}User set: ${result.user.email}`)
            c.set('user', result.user)
          }
        }
      } catch (e) {
        console.error(`${prefix}Auth error:`, e)
      }
    }

    await next()
  }
}
