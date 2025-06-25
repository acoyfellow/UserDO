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

// Organization schemas
export const CreateOrganizationRequestSchema = z.object({
  name: z.string().min(1).max(100),
});

export const AddMemberRequestSchema = z.object({
  organizationId: z.string(),
  email: z.string().email(),
  role: z.enum(['admin', 'member']).default('member'),
});

export const UpdateMemberRoleRequestSchema = z.object({
  organizationId: z.string(),
  email: z.string().email(),
  role: z.enum(['admin', 'member']),
});

export const RemoveMemberRequestSchema = z.object({
  organizationId: z.string(),
  email: z.string().email(),
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

export const OrganizationResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  ownerId: z.string(),
  createdAt: z.string(),
  members: z.array(z.object({
    email: z.string().email(),
    role: z.enum(['admin', 'member']),
    addedAt: z.string(),
  })),
});

export const OrganizationsResponseSchema = z.object({
  organizations: z.array(OrganizationResponseSchema),
});

export const MemberOrganizationsResponseSchema = z.object({
  organizations: z.array(z.object({
    organizationId: z.string(),
    organizationName: z.string(),
    role: z.enum(['admin', 'member']),
    addedAt: z.string(),
  })),
});

// Type exports
export type SignupRequest = z.infer<typeof SignupRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type PasswordResetRequest = z.infer<typeof PasswordResetRequestSchema>;
export type PasswordResetConfirm = z.infer<typeof PasswordResetConfirmSchema>;
export type SetDataRequest = z.infer<typeof SetDataRequestSchema>;

// Organization types
export type CreateOrganizationRequest = z.infer<typeof CreateOrganizationRequestSchema>;
export type AddMemberRequest = z.infer<typeof AddMemberRequestSchema>;
export type UpdateMemberRoleRequest = z.infer<typeof UpdateMemberRoleRequestSchema>;
export type RemoveMemberRequest = z.infer<typeof RemoveMemberRequestSchema>;

export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;
export type DataResponse = z.infer<typeof DataResponseSchema>;
export type EventsResponse = z.infer<typeof EventsResponseSchema>;
export type OrganizationResponse = z.infer<typeof OrganizationResponseSchema>;
export type OrganizationsResponse = z.infer<typeof OrganizationsResponseSchema>;
export type MemberOrganizationsResponse = z.infer<typeof MemberOrganizationsResponseSchema>;

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
  // Organization endpoints
  'POST /api/organizations': {
    body: CreateOrganizationRequest;
    response: { organization: OrganizationResponse } | ErrorResponse;
  };
  'GET /api/organizations': {
    response: OrganizationsResponse | ErrorResponse;
  };
  'GET /api/organizations/member': {
    response: MemberOrganizationsResponse | ErrorResponse;
  };
  'GET /api/organizations/:id': {
    response: { organization: OrganizationResponse } | ErrorResponse;
  };
  'POST /api/organizations/members': {
    body: AddMemberRequest;
    response: SuccessResponse | ErrorResponse;
  };
  'DELETE /api/organizations/members': {
    body: RemoveMemberRequest;
    response: SuccessResponse | ErrorResponse;
  };
  'PUT /api/organizations/members/role': {
    body: UpdateMemberRoleRequest;
    response: SuccessResponse | ErrorResponse;
  };
}

// Helper type for extracting endpoint types
export type EndpointRequest<T extends keyof UserDOEndpoints> =
  UserDOEndpoints[T] extends { body: infer B } ? B : never;

export type EndpointResponse<T extends keyof UserDOEndpoints> =
  UserDOEndpoints[T]['response'];

export type EndpointQuery<T extends keyof UserDOEndpoints> =
  UserDOEndpoints[T] extends { query: infer Q } ? Q : never; 