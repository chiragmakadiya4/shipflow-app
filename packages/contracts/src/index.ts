import { Type, type Static } from '@sinclair/typebox';

export type ApiError = {
  error: {
    code: string;
    message: string;
  };
};

export type User = {
  id: string;
  email: string;
};

export type Organization = {
  id: string;
  name: string;
  role: Role;
};

export type Project = {
  id: string;
  organizationId: string;
  name: string;
};

export const RoleSchema = Type.Union([Type.Literal('owner'), Type.Literal('member')]);
export type Role = Static<typeof RoleSchema>;

export const RepositoryProviderSchema = Type.Literal('github');
export type RepositoryProvider = Static<typeof RepositoryProviderSchema>;

export const EnvironmentNameSchema = Type.Union([
  Type.Literal('staging'),
  Type.Literal('production'),
]);
export type EnvironmentName = Static<typeof EnvironmentNameSchema>;

export const DeploymentStatusSchema = Type.Union([
  Type.Literal('pending'),
  Type.Literal('running'),
  Type.Literal('succeeded'),
  Type.Literal('failed'),
  Type.Literal('rolled_back'),
]);
export type DeploymentStatus = Static<typeof DeploymentStatusSchema>;

export type Repository = {
  id: string;
  projectId: string;
  provider: RepositoryProvider;
  owner: string;
  name: string;
  defaultBranch: string;
};

export type Environment = {
  id: string;
  projectId: string;
  name: EnvironmentName;
};

export type Deployment = {
  id: string;
  projectId: string;
  environment: EnvironmentName;
  commitSha: string;
  artifactDigest: string;
  status: DeploymentStatus;
  promotedFromDeploymentId?: string;
};

export type AuditEvent = {
  id: string;
  projectId: string;
  actorUserId: string;
  action: string;
  deploymentId: string;
  occurredAt: string;
};

export const CreateRepositoryRequestSchema = Type.Object({
  projectId: Type.String({ format: 'uuid' }),
  provider: RepositoryProviderSchema,
  owner: Type.String({ minLength: 1, maxLength: 100 }),
  name: Type.String({ minLength: 1, maxLength: 100 }),
  defaultBranch: Type.String({ minLength: 1, maxLength: 100 }),
});
export type CreateRepositoryRequest = Static<typeof CreateRepositoryRequestSchema>;

export const CreateDeploymentRequestSchema = Type.Object({
  projectId: Type.String({ format: 'uuid' }),
  environment: EnvironmentNameSchema,
  commitSha: Type.String({ pattern: '^[0-9a-f]{7,64}$' }),
  artifactDigest: Type.String({ pattern: '^sha256:[0-9a-f]{64}$' }),
});
export type CreateDeploymentRequest = Static<typeof CreateDeploymentRequestSchema>;

export const NameRequestSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
});
export type NameRequest = Static<typeof NameRequestSchema>;

export const ProjectQuerySchema = Type.Object({
  organizationId: Type.String({ format: 'uuid' }),
});

export const DeploymentQuerySchema = Type.Object({
  projectId: Type.String({ format: 'uuid' }),
});

export const DeploymentStatusRequestSchema = Type.Object({
  status: Type.Union([
    Type.Literal('running'),
    Type.Literal('succeeded'),
    Type.Literal('failed'),
    Type.Literal('pending'),
  ]),
});
export type DeploymentStatusRequest = Static<typeof DeploymentStatusRequestSchema>;

export type CreateOrganizationRequest = { name: string };
export type CreateProjectRequest = { organizationId: string; name: string };

export const CreateOrganizationRequestSchema = NameRequestSchema;
export type CreateOrganizationRequestFromSchema = Static<typeof CreateOrganizationRequestSchema>;

export const CreateProjectRequestSchema = Type.Object({
  organizationId: Type.String({ format: 'uuid' }),
  name: Type.String({ minLength: 1, maxLength: 100 }),
});
export type CreateProjectRequestFromSchema = Static<typeof CreateProjectRequestSchema>;

export const apiPaths = {
  health: '/health',
  organizations: '/organizations',
  projects: '/projects',
  repositories: '/repositories',
  deployments: '/deployments',
} as const;
