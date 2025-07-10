export { UserDO, getUserDO, hashEmailForId, migrateUserEmail, type Env } from './UserDO.js';
export { UserDODatabase } from './database/index.js';
export { GenericTable, type Table } from './database/table.js';
export { GenericQuery } from './database/query.js';
export { UserDOClient } from './client.js';

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
} from './jwt-utils.js';

// Worker exports
export { userDOWorker, createUserDOWorker, createWebSocketHandler, getUserDOFromContext, broadcastToUser } from './worker.js';
export { createAuthMiddleware } from './authMiddleware.js';
export type { UserDOEndpoints, EndpointRequest, EndpointResponse, EndpointQuery } from './worker-types.js';
export * from './worker-types.js';
