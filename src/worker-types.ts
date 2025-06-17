import { z } from 'zod';

// Request/Response schemas for typed endpoints
export const SignupRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const PasswordResetRequestSchema = z.object({
  email: z.string().email(),
});

export const PasswordResetConfirmSchema = z.object({
  resetToken: z.string(),
  newPassword: z.string().min(8),
});

export const SetDataRequestSchema = z.object({
  key: z.string(),
  value: z.unknown(),
});

// Response schemas
export const AuthResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    createdAt: z.string(),
  }),
  token: z.string(),
  refreshToken: z.string(),
});

export const ErrorResponseSchema = z.object({
  error: z.string(),
});

export const SuccessResponseSchema = z.object({
  ok: z.literal(true),
});

export const DataResponseSchema = z.object({
  ok: z.literal(true),
  data: z.unknown(),
});

export const EventsResponseSchema = z.array(z.object({
  event: z.string(),
  data: z.unknown(),
  timestamp: z.number(),
}));

// Type exports
export type SignupRequest = z.infer<typeof SignupRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type PasswordResetRequest = z.infer<typeof PasswordResetRequestSchema>;
export type PasswordResetConfirm = z.infer<typeof PasswordResetConfirmSchema>;
export type SetDataRequest = z.infer<typeof SetDataRequestSchema>;

export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;
export type DataResponse = z.infer<typeof DataResponseSchema>;
export type EventsResponse = z.infer<typeof EventsResponseSchema>;

// Endpoint definitions for OpenAPI/documentation
export interface UserDOEndpoints {
  'POST /api/signup': {
    body: SignupRequest;
    response: AuthResponse | ErrorResponse;
  };
  'POST /api/login': {
    body: LoginRequest;
    response: AuthResponse | ErrorResponse;
  };
  'POST /api/logout': {
    response: SuccessResponse;
  };
  'GET /api/me': {
    response: { user: AuthResponse['user'] } | ErrorResponse;
  };
  'POST /api/password-reset/request': {
    body: PasswordResetRequest;
    response: { ok: true; message: string; resetToken?: string } | ErrorResponse;
  };
  'POST /api/password-reset/confirm': {
    body: PasswordResetConfirm;
    response: { ok: true; message: string } | ErrorResponse;
  };
  'GET /api/events': {
    query: { since?: string };
    response: EventsResponse | ErrorResponse;
  };
  'GET /data': {
    response: DataResponse | ErrorResponse;
  };
  'POST /data': {
    body: SetDataRequest;
    response: DataResponse | ErrorResponse;
  };
  'GET /protected/profile': {
    response: { ok: true; user: AuthResponse['user'] } | ErrorResponse;
  };
}

// Helper type for extracting endpoint types
export type EndpointRequest<T extends keyof UserDOEndpoints> =
  UserDOEndpoints[T] extends { body: infer B } ? B : never;

export type EndpointResponse<T extends keyof UserDOEndpoints> =
  UserDOEndpoints[T]['response'];

export type EndpointQuery<T extends keyof UserDOEndpoints> =
  UserDOEndpoints[T] extends { query: infer Q } ? Q : never; 