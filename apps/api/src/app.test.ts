import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { InMemoryRepository } from './repository.js';

const apps = new Set<Awaited<ReturnType<typeof createApp>>>();

afterEach(async () => {
  await Promise.all([...apps].map((app) => app.close()));
  apps.clear();
});

async function testApp() {
  const app = createApp(new InMemoryRepository());
  apps.add(app);
  return app;
}

describe('SaaS API', () => {
  it('returns a health response without authentication', async () => {
    const app = await testApp();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('rejects requests without a valid user', async () => {
    const app = await testApp();
    const response = await app.inject({ method: 'GET', url: '/organizations' });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHENTICATED');
  });

  it('creates and lists an organization and project', async () => {
    const app = await testApp();
    const headers = { 'x-user-id': 'demo-user' };
    const organizationResponse = await app.inject({
      method: 'POST',
      url: '/organizations',
      headers,
      payload: { name: 'Acme' },
    });
    expect(organizationResponse.statusCode).toBe(201);
    const organization = organizationResponse.json();
    const projectResponse = await app.inject({
      method: 'POST',
      url: '/projects',
      headers,
      payload: { organizationId: organization.id, name: 'Platform' },
    });
    expect(projectResponse.statusCode).toBe(201);
    const projectsResponse = await app.inject({
      method: 'GET',
      url: `/projects?organizationId=${organization.id}`,
      headers,
    });
    expect(projectsResponse.json()).toHaveLength(1);
  });

  it('prevents a user from accessing another organization', async () => {
    const app = await testApp();
    const ownerHeaders = { 'x-user-id': 'demo-user' };
    const organizationResponse = await app.inject({
      method: 'POST',
      url: '/organizations',
      headers: ownerHeaders,
      payload: { name: 'Private' },
    });
    const organization = organizationResponse.json();
    const response = await app.inject({
      method: 'GET',
      url: `/projects?organizationId=${organization.id}`,
      headers: { 'x-user-id': 'other-user' },
    });
    expect(response.statusCode).toBe(403);
  });

  it('validates project input', async () => {
    const app = await testApp();
    const response = await app.inject({
      method: 'POST',
      url: '/organizations',
      headers: { 'x-user-id': 'demo-user' },
      payload: { name: '' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('INVALID_REQUEST');
  });

  it('promotes only a successful staging deployment with the same artifact', async () => {
    const app = await testApp();
    const headers = { 'x-user-id': 'demo-user' };
    const organization = (
      await app.inject({
        method: 'POST',
        url: '/organizations',
        headers,
        payload: { name: 'ShipFlow' },
      })
    ).json();
    const project = (
      await app.inject({
        method: 'POST',
        url: '/projects',
        headers,
        payload: { organizationId: organization.id, name: 'Release API' },
      })
    ).json();
    const deployment = (
      await app.inject({
        method: 'POST',
        url: '/deployments',
        headers,
        payload: {
          projectId: project.id,
          environment: 'staging',
          commitSha: '8f31c2a',
          artifactDigest: `sha256:${'a'.repeat(64)}`,
        },
      })
    ).json();
    const beforeSuccess = await app.inject({
      method: 'POST',
      url: `/deployments/${deployment.id}/promote`,
      headers,
    });
    expect(beforeSuccess.statusCode).toBe(409);
    await app.inject({
      method: 'POST',
      url: `/deployments/${deployment.id}/status`,
      headers,
      payload: { status: 'running' },
    });
    await app.inject({
      method: 'POST',
      url: `/deployments/${deployment.id}/status`,
      headers,
      payload: { status: 'succeeded' },
    });
    const promotion = await app.inject({
      method: 'POST',
      url: `/deployments/${deployment.id}/promote`,
      headers,
    });
    expect(promotion.statusCode).toBe(201);
    expect(promotion.json()).toMatchObject({
      environment: 'production',
      commitSha: '8f31c2a',
      artifactDigest: `sha256:${'a'.repeat(64)}`,
      promotedFromDeploymentId: deployment.id,
    });
  });

  it('does not allow another organization to create a repository for a project', async () => {
    const app = await testApp();
    const ownerHeaders = { 'x-user-id': 'demo-user' };
    const organization = (
      await app.inject({
        method: 'POST',
        url: '/organizations',
        headers: ownerHeaders,
        payload: { name: 'Private' },
      })
    ).json();
    const project = (
      await app.inject({
        method: 'POST',
        url: '/projects',
        headers: ownerHeaders,
        payload: { organizationId: organization.id, name: 'Private App' },
      })
    ).json();
    const response = await app.inject({
      method: 'POST',
      url: '/repositories',
      headers: { 'x-user-id': 'other-user' },
      payload: {
        projectId: project.id,
        provider: 'github',
        owner: 'acme',
        name: 'private-app',
        defaultBranch: 'main',
      },
    });
    expect(response.statusCode).toBe(403);
  });
});
