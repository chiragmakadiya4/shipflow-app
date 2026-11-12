import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import {
  CreateOrganizationRequestSchema,
  CreateDeploymentRequestSchema,
  CreateProjectRequestSchema,
  CreateRepositoryRequestSchema,
  DeploymentQuerySchema,
  DeploymentStatusRequestSchema,
  ProjectQuerySchema,
  type ApiError,
  type DeploymentStatusRequest,
} from '@fullstack/contracts';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { Repository } from './repository.js';

export function createApp(repository: Repository): FastifyInstance {
  const app = Fastify({ logger: false }).withTypeProvider<TypeBoxTypeProvider>();
  void app.register(cors, { origin: true });

  app.setErrorHandler((error, _request, reply) => {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isValidationError = typeof error === 'object' && error !== null && 'validation' in error;
    const statusCode =
      message === 'FORBIDDEN'
        ? 403
        : message === 'NOT_FOUND'
          ? 404
          : ['DEPLOYMENT_NOT_PROMOTABLE', 'INVALID_DEPLOYMENT_TRANSITION'].includes(message)
            ? 409
            : isValidationError || message === 'DEPLOYMENT_TARGET_INVALID'
              ? 400
              : 500;
    const payload: ApiError = {
      error: {
        code:
          statusCode === 403
            ? 'FORBIDDEN'
            : statusCode === 404
              ? 'NOT_FOUND'
              : statusCode === 409
                ? 'CONFLICT'
                : statusCode === 400
                  ? 'INVALID_REQUEST'
                  : 'INTERNAL_ERROR',
        message: statusCode === 500 ? 'Internal server error' : message,
      },
    };
    return reply.status(statusCode).send(payload);
  });

  app.get('/health', async () => ({ status: 'ok' }));

  app.addHook('preHandler', async (request, reply) => {
    if (request.url === '/health') return;
    const userId = request.headers['x-user-id'];
    if (typeof userId !== 'string' || !(await repository.findUser(userId))) {
      return reply
        .status(401)
        .send({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }
  });

  app.get('/organizations', async (request) => {
    return repository.listOrganizations(request.headers['x-user-id'] as string);
  });

  app.post(
    '/organizations',
    { schema: { body: CreateOrganizationRequestSchema } },
    async (request, reply) => {
      const input = request.body;
      const organization = await repository.createOrganization(
        request.headers['x-user-id'] as string,
        input.name,
      );
      return reply.status(201).send(organization);
    },
  );

  app.get('/projects', { schema: { querystring: ProjectQuerySchema } }, async (request) => {
    const organizationId = request.query.organizationId;
    return repository.listProjects(request.headers['x-user-id'] as string, organizationId);
  });

  app.post(
    '/projects',
    { schema: { body: CreateProjectRequestSchema } },
    async (request, reply) => {
      const input = request.body;
      const project = await repository.createProject(
        request.headers['x-user-id'] as string,
        input.organizationId,
        input.name,
      );
      return reply.status(201).send(project);
    },
  );

  app.post(
    '/repositories',
    { schema: { body: CreateRepositoryRequestSchema } },
    async (request, reply) => {
      const repositoryConnection = await repository.createRepository(
        request.headers['x-user-id'] as string,
        request.body,
      );
      return reply.status(201).send(repositoryConnection);
    },
  );

  app.get('/deployments', { schema: { querystring: DeploymentQuerySchema } }, async (request) => {
    const projectId = request.query.projectId;
    return repository.listDeployments(request.headers['x-user-id'] as string, projectId);
  });

  app.post(
    '/deployments',
    { schema: { body: CreateDeploymentRequestSchema } },
    async (request, reply) => {
      const deployment = await repository.createDeployment(
        request.headers['x-user-id'] as string,
        request.body,
      );
      return reply.status(201).send(deployment);
    },
  );

  app.post<{ Params: { id: string }; Body: DeploymentStatusRequest }>(
    '/deployments/:id/status',
    { schema: { body: DeploymentStatusRequestSchema } },
    async (request) => {
      return repository.updateDeploymentStatus(
        request.headers['x-user-id'] as string,
        request.params.id,
        request.body.status,
      );
    },
  );

  app.post<{ Params: { id: string } }>('/deployments/:id/promote', async (request, reply) => {
    const productionDeployment = await repository.promoteDeployment(
      request.headers['x-user-id'] as string,
      request.params.id,
    );
    return reply.status(201).send(productionDeployment);
  });

  app.get('/audit-events', { schema: { querystring: DeploymentQuerySchema } }, async (request) => {
    const projectId = request.query.projectId;
    return repository.listAuditEvents(request.headers['x-user-id'] as string, projectId);
  });

  return app;
}
