export { UserDO, getUserDO, hashEmailForId, migrateUserEmail, type Env } from './UserDO';
export { UserDODatabase } from './database/index';
export { GenericTable, type Table } from './database/table';
export { GenericQuery } from './database/query';

// JWT utilities
export {
  decodeJWT,
  verifyJWT,
  isTokenExpired,
  getEmailFromToken,
  signJWT,
  generateAccessToken,
  generateRefreshToken,
  generatePasswordResetToken,
  type JwtPayload
} from './jwt-utils';

// Worker exports
export { userDOWorker, createUserDOWorker, createWebSocketHandler, getUserDOFromContext, broadcastToUser } from './worker';
export { createAuthMiddleware } from './authMiddleware';
export type { UserDOEndpoints, EndpointRequest, EndpointResponse, EndpointQuery } from './worker-types';
export * from './worker-types';
