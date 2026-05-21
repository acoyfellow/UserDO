import { createAuthMiddleware } from './authMiddleware.js'
import type { Context, Next } from 'hono'
import type { UserDO } from './UserDO.js'

// Mock hono/cookie functions
const mockGetCookie = jest.fn()
const mockSetCookie = jest.fn()
const mockDeleteCookie = jest.fn()

jest.mock('hono/cookie', () => ({
  getCookie: (...args: unknown[]) => mockGetCookie(...args),
  setCookie: (...args: unknown[]) => mockSetCookie(...args),
  deleteCookie: (...args: unknown[]) => mockDeleteCookie(...args),
}))

// Helper to create a base64url encoded JSON string (JWT style)
function encodeBase64Url(data: Record<string, unknown>): string {
  return btoa(JSON.stringify(data))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// Helper to create a mock JWT token
function createMockJWT(payload: Record<string, unknown>): string {
  const header = encodeBase64Url({ alg: 'HS256', typ: 'JWT' })
  const body = encodeBase64Url(payload)
  const signature = 'signature'
  return `${header}.${body}.${signature}`
}

describe('createAuthMiddleware', () => {
  let mockContext: Context
  let mockNext: Next
  let mockUserDO: UserDO
  let getUserDO: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetCookie.mockReset()
    mockSetCookie.mockReset()
    mockDeleteCookie.mockReset()

    // Mock context
    mockContext = {
      req: {
        url: 'https://example.com/test',
      },
      set: jest.fn(),
    } as unknown as Context

    mockNext = jest.fn()
    mockUserDO = {
      verifyToken: jest.fn(),
      refreshToken: jest.fn(),
    } as unknown as UserDO

    getUserDO = jest.fn().mockReturnValue(mockUserDO)
  })

  describe('when no tokens are present', () => {
    it('should call next() without setting user', async () => {
      mockGetCookie.mockReturnValue('')

      const middleware = createAuthMiddleware(getUserDO)
      await middleware(mockContext, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockContext.set).not.toHaveBeenCalled()
      expect(getUserDO).not.toHaveBeenCalled()
    })
  })

  describe('when token is present and valid', () => {
    it('should verify token and set user', async () => {
      const email = 'test@example.com'
      const token = createMockJWT({ email, exp: Date.now() / 1000 + 3600 })
      const user = { email, id: '123' }

      mockGetCookie.mockImplementation((c: Context, name: string) => {
        if (name === 'token') return token
        return ''
      })

      mockUserDO.verifyToken = jest.fn().mockResolvedValue({ ok: true, user })

      const middleware = createAuthMiddleware(getUserDO)
      await middleware(mockContext, mockNext)

      expect(getUserDO).toHaveBeenCalledWith(mockContext, email)
      expect(mockUserDO.verifyToken).toHaveBeenCalledWith({ token })
      expect(mockContext.set).toHaveBeenCalledWith('user', user)
      expect(mockNext).toHaveBeenCalled()
    })
  })

  describe('when token is invalid but refreshToken is valid', () => {
    it('should refresh token and set user', async () => {
      const email = 'test@example.com'
      const token = createMockJWT({ email, exp: Date.now() / 1000 - 100 }) // expired
      const refreshToken = createMockJWT({ email, exp: Date.now() / 1000 + 3600 })
      const newToken = createMockJWT({ email, exp: Date.now() / 1000 + 3600 })
      const user = { email, id: '123' }

      mockGetCookie.mockImplementation((c: Context, name: string) => {
        if (name === 'token') return token
        if (name === 'refreshToken') return refreshToken
        return ''
      })

      mockUserDO.verifyToken = jest.fn()
        .mockResolvedValueOnce({ ok: false }) // first verification fails
        .mockResolvedValueOnce({ ok: true, user }) // second verification succeeds

      mockUserDO.refreshToken = jest.fn().mockResolvedValue({ token: newToken })

      const middleware = createAuthMiddleware(getUserDO)
      await middleware(mockContext, mockNext)

      expect(mockUserDO.verifyToken).toHaveBeenCalledTimes(2)
      expect(mockUserDO.refreshToken).toHaveBeenCalledWith({ refreshToken })
      expect(mockSetCookie).toHaveBeenCalledWith(
        mockContext,
        'token',
        newToken,
        {
          httpOnly: true,
          secure: true,
          path: '/',
          sameSite: 'Lax',
        }
      )
      expect(mockContext.set).toHaveBeenCalledWith('user', user)
    })
  })

  describe('when both token and refreshToken are invalid', () => {
    it('should delete cookies and not set user', async () => {
      const email = 'test@example.com'
      const token = createMockJWT({ email, exp: Date.now() / 1000 - 100 })
      const refreshToken = createMockJWT({ email, exp: Date.now() / 1000 - 100 })

      mockGetCookie.mockImplementation((c: Context, name: string) => {
        if (name === 'token') return token
        if (name === 'refreshToken') return refreshToken
        return ''
      })

      mockUserDO.verifyToken = jest.fn().mockResolvedValue({ ok: false })
      mockUserDO.refreshToken = jest.fn().mockRejectedValue(new Error('Refresh failed'))

      const middleware = createAuthMiddleware(getUserDO)
      await middleware(mockContext, mockNext)

      expect(mockUserDO.refreshToken).toHaveBeenCalledWith({ refreshToken })
      expect(mockDeleteCookie).toHaveBeenCalledWith(mockContext, 'token')
      expect(mockDeleteCookie).toHaveBeenCalledWith(mockContext, 'refreshToken')
      expect(mockContext.set).not.toHaveBeenCalled()
    })
  })

  describe('when token has no email', () => {
    it('should not set user', async () => {
      const token = createMockJWT({ sub: '123', exp: Date.now() / 1000 + 3600 })

      mockGetCookie.mockReturnValue(token)

      const middleware = createAuthMiddleware(getUserDO)
      await middleware(mockContext, mockNext)

      expect(getUserDO).not.toHaveBeenCalled()
      expect(mockContext.set).not.toHaveBeenCalled()
      expect(mockNext).toHaveBeenCalled()
    })
  })

  describe('when refreshToken is used as primary token', () => {
    it('should verify and set user using refreshToken email', async () => {
      const email = 'refresh@example.com'
      const refreshToken = createMockJWT({ email, exp: Date.now() / 1000 + 3600 })
      const user = { email, id: '456' }

      mockGetCookie.mockImplementation((c: Context, name: string) => {
        if (name === 'refreshToken') return refreshToken
        return ''
      })

      mockUserDO.verifyToken = jest.fn().mockResolvedValue({ ok: true, user })

      const middleware = createAuthMiddleware(getUserDO)
      await middleware(mockContext, mockNext)

      expect(getUserDO).toHaveBeenCalledWith(mockContext, email)
      expect(mockContext.set).toHaveBeenCalledWith('user', user)
    })
  })

  describe('when logPrefix is provided', () => {
    it('should include prefix in log messages', async () => {
      const email = 'test@example.com'
      const token = createMockJWT({ email, exp: Date.now() / 1000 + 3600 })
      const user = { email, id: '123' }

      mockGetCookie.mockReturnValue(token)
      mockUserDO.verifyToken = jest.fn().mockResolvedValue({ ok: true, user })

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      const middleware = createAuthMiddleware(getUserDO, 'TestPrefix')
      await middleware(mockContext, mockNext)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TestPrefix]'),
        expect.anything()
      )

      consoleSpy.mockRestore()
    })
  })

  describe('when request is not secure (http)', () => {
    it('should set secure cookie option to false', async () => {
      const email = 'test@example.com'
      const token = createMockJWT({ email, exp: Date.now() / 1000 - 100 })
      const refreshToken = createMockJWT({ email, exp: Date.now() / 1000 + 3600 })
      const newToken = createMockJWT({ email, exp: Date.now() / 1000 + 3600 })
      const user = { email, id: '123' }

      mockContext = {
        req: {
          url: 'http://example.com/test',
        },
        set: jest.fn(),
      } as unknown as Context

      mockGetCookie.mockImplementation((c: Context, name: string) => {
        if (name === 'token') return token
        if (name === 'refreshToken') return refreshToken
        return ''
      })

      mockUserDO.verifyToken = jest.fn()
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: true, user })

      mockUserDO.refreshToken = jest.fn().mockResolvedValue({ token: newToken })

      const middleware = createAuthMiddleware(getUserDO)
      await middleware(mockContext, mockNext)

      expect(mockSetCookie).toHaveBeenCalledWith(
        mockContext,
        'token',
        newToken,
        expect.objectContaining({
          secure: false,
        })
      )
    })
  })

  describe('when verifyToken throws an error', () => {
    it('should catch error and continue without setting user', async () => {
      const email = 'test@example.com'
      const token = createMockJWT({ email, exp: Date.now() / 1000 + 3600 })

      mockGetCookie.mockReturnValue(token)
      mockUserDO.verifyToken = jest.fn().mockRejectedValue(new Error('Verification error'))

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      const middleware = createAuthMiddleware(getUserDO)
      await middleware(mockContext, mockNext)

      expect(consoleSpy).toHaveBeenCalled()
      expect(mockContext.set).not.toHaveBeenCalled()
      expect(mockNext).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('when token is malformed', () => {
    it('should handle gracefully and not set user', async () => {
      const malformedToken = 'not.a.valid.jwt.token'

      mockGetCookie.mockReturnValue(malformedToken)

      const middleware = createAuthMiddleware(getUserDO)
      await middleware(mockContext, mockNext)

      expect(getUserDO).not.toHaveBeenCalled()
      expect(mockContext.set).not.toHaveBeenCalled()
      expect(mockNext).toHaveBeenCalled()
    })
  })

  describe('when only refreshToken is present', () => {
    it('should use refreshToken for verification', async () => {
      const email = 'refresh@example.com'
      const refreshToken = createMockJWT({ email, exp: Date.now() / 1000 + 3600 })
      const user = { email, id: '789' }

      mockGetCookie.mockImplementation((c: Context, name: string) => {
        if (name === 'refreshToken') return refreshToken
        return ''
      })

      mockUserDO.verifyToken = jest.fn().mockResolvedValue({ ok: true, user })

      const middleware = createAuthMiddleware(getUserDO)
      await middleware(mockContext, mockNext)

      expect(getUserDO).toHaveBeenCalledWith(mockContext, email)
      expect(mockContext.set).toHaveBeenCalledWith('user', user)
    })
  })

  describe('when email is uppercase in token', () => {
    it('should convert email to lowercase', async () => {
      const email = 'TEST@EXAMPLE.COM'
      const token = createMockJWT({ email, exp: Date.now() / 1000 + 3600 })
      const user = { email: 'test@example.com', id: '123' }

      mockGetCookie.mockReturnValue(token)
      mockUserDO.verifyToken = jest.fn().mockResolvedValue({ ok: true, user })

      const middleware = createAuthMiddleware(getUserDO)
      await middleware(mockContext, mockNext)

      expect(getUserDO).toHaveBeenCalledWith(mockContext, 'test@example.com')
    })
  })
})
