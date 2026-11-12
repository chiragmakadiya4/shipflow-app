import type { Pool } from 'pg';
import type {
  AuditEvent,
  CreateDeploymentRequest,
  CreateRepositoryRequest,
  Deployment,
  DeploymentStatus,
  Organization,
  Project,
  Repository as RepositoryConnection,
  Role,
  User,
} from '@fullstack/contracts';
import type { Repository } from './repository.js';

type OrganizationRow = { id: string; name: string; role: Role };
type ProjectRow = { id: string; organization_id: string; name: string };
type RepositoryRow = {
  id: string;
  project_id: string;
  provider: 'github';
  owner: string;
  name: string;
  default_branch: string;
};
type DeploymentRow = {
  id: string;
  project_id: string;
  environment: 'staging' | 'production';
  commit_sha: string;
  artifact_digest: string;
  status: DeploymentStatus;
  promoted_from_deployment_id: string | null;
};
type AuditEventRow = {
  id: string;
  project_id: string;
  actor_user_id: string;
  action: string;
  deployment_id: string;
  occurred_at: string;
};

export class PostgresRepository implements Repository {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async findUser(userId: string): Promise<User | undefined> {
    const result = await this.pool.query<User>('SELECT id, email FROM users WHERE id = $1', [
      userId,
    ]);
    return result.rows[0];
  }

  async createOrganization(userId: string, name: string): Promise<Organization> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const organizationResult = await client.query<{ id: string; name: string }>(
        'INSERT INTO organizations (name) VALUES ($1) RETURNING id, name',
        [name],
      );
      const organization = organizationResult.rows[0];
      await client.query(
        'INSERT INTO organization_memberships (user_id, organization_id, role) VALUES ($1, $2, $3)',
        [userId, organization.id, 'owner'],
      );
      await client.query('COMMIT');
      return { ...organization, role: 'owner' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listOrganizations(userId: string): Promise<Organization[]> {
    const result = await this.pool.query<OrganizationRow>(
      `SELECT o.id, o.name, m.role
       FROM organizations o
       JOIN organization_memberships m ON m.organization_id = o.id
       WHERE m.user_id = $1
       ORDER BY o.created_at DESC`,
      [userId],
    );
    return result.rows;
  }

  async createProject(userId: string, organizationId: string, name: string): Promise<Project> {
    await this.assertMember(userId, organizationId);
    const result = await this.pool.query<ProjectRow>(
      'INSERT INTO projects (organization_id, name) VALUES ($1, $2) RETURNING id, organization_id, name',
      [organizationId, name],
    );
    const project = result.rows[0];
    return { id: project.id, organizationId: project.organization_id, name: project.name };
  }

  async listProjects(userId: string, organizationId: string): Promise<Project[]> {
    await this.assertMember(userId, organizationId);
    const result = await this.pool.query<ProjectRow>(
      'SELECT id, organization_id, name FROM projects WHERE organization_id = $1 ORDER BY created_at DESC',
      [organizationId],
    );
    return result.rows.map((project) => ({
      id: project.id,
      organizationId: project.organization_id,
      name: project.name,
    }));
  }

  async createRepository(
    userId: string,
    input: CreateRepositoryRequest,
  ): Promise<RepositoryConnection> {
    await this.assertProjectMember(userId, input.projectId);
    const result = await this.pool.query<RepositoryRow>(
      `INSERT INTO repositories (project_id, provider, owner, name, default_branch)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, project_id, provider, owner, name, default_branch`,
      [input.projectId, input.provider, input.owner, input.name, input.defaultBranch],
    );
    return this.mapRepository(result.rows[0]);
  }

  async createDeployment(userId: string, input: CreateDeploymentRequest): Promise<Deployment> {
    await this.assertProjectMember(userId, input.projectId);
    if (input.environment !== 'staging') throw new Error('DEPLOYMENT_TARGET_INVALID');
    const result = await this.pool.query<DeploymentRow>(
      `INSERT INTO deployments (project_id, environment, commit_sha, artifact_digest, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id, project_id, environment, commit_sha, artifact_digest, status, promoted_from_deployment_id`,
      [input.projectId, input.environment, input.commitSha, input.artifactDigest],
    );
    const deployment = this.mapDeployment(result.rows[0]);
    await this.recordAudit(userId, deployment.projectId, 'deployment.created', deployment.id);
    return deployment;
  }

  async listDeployments(userId: string, projectId: string): Promise<Deployment[]> {
    await this.assertProjectMember(userId, projectId);
    const result = await this.pool.query<DeploymentRow>(
      `SELECT id, project_id, environment, commit_sha, artifact_digest, status, promoted_from_deployment_id
       FROM deployments WHERE project_id = $1 ORDER BY created_at DESC`,
      [projectId],
    );
    return result.rows.map((row) => this.mapDeployment(row));
  }

  async updateDeploymentStatus(
    userId: string,
    deploymentId: string,
    status: DeploymentStatus,
  ): Promise<Deployment> {
    const current = await this.findDeploymentForMember(userId, deploymentId);
    if (!isAllowedTransition(current.status, status))
      throw new Error('INVALID_DEPLOYMENT_TRANSITION');
    const result = await this.pool.query<DeploymentRow>(
      `UPDATE deployments SET status = $1 WHERE id = $2
       RETURNING id, project_id, environment, commit_sha, artifact_digest, status, promoted_from_deployment_id`,
      [status, deploymentId],
    );
    const deployment = this.mapDeployment(result.rows[0]);
    await this.recordAudit(userId, deployment.projectId, `deployment.${status}`, deployment.id);
    return deployment;
  }

  async promoteDeployment(userId: string, deploymentId: string): Promise<Deployment> {
    const staging = await this.findDeploymentForMember(userId, deploymentId);
    if (staging.environment !== 'staging' || staging.status !== 'succeeded')
      throw new Error('DEPLOYMENT_NOT_PROMOTABLE');
    const result = await this.pool.query<DeploymentRow>(
      `INSERT INTO deployments (project_id, environment, commit_sha, artifact_digest, status, promoted_from_deployment_id)
       VALUES ($1, 'production', $2, $3, 'pending', $4)
       RETURNING id, project_id, environment, commit_sha, artifact_digest, status, promoted_from_deployment_id`,
      [staging.projectId, staging.commitSha, staging.artifactDigest, staging.id],
    );
    const deployment = this.mapDeployment(result.rows[0]);
    await this.recordAudit(userId, deployment.projectId, 'deployment.promoted', deployment.id);
    return deployment;
  }

  async listAuditEvents(userId: string, projectId: string): Promise<AuditEvent[]> {
    await this.assertProjectMember(userId, projectId);
    const result = await this.pool.query<AuditEventRow>(
      `SELECT id, project_id, actor_user_id, action, deployment_id, occurred_at
       FROM audit_events WHERE project_id = $1 ORDER BY occurred_at ASC`,
      [projectId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      actorUserId: row.actor_user_id,
      action: row.action,
      deploymentId: row.deployment_id,
      occurredAt: row.occurred_at,
    }));
  }

  private async assertMember(userId: string, organizationId: string): Promise<void> {
    const result = await this.pool.query(
      'SELECT 1 FROM organization_memberships WHERE user_id = $1 AND organization_id = $2',
      [userId, organizationId],
    );
    if (result.rowCount !== 1) throw new Error('FORBIDDEN');
  }

  private async assertProjectMember(userId: string, projectId: string): Promise<void> {
    const result = await this.pool.query<{ organization_id: string }>(
      'SELECT organization_id FROM projects WHERE id = $1',
      [projectId],
    );
    if (!result.rows[0]) throw new Error('NOT_FOUND');
    await this.assertMember(userId, result.rows[0].organization_id);
  }

  private async findDeploymentForMember(userId: string, deploymentId: string): Promise<Deployment> {
    const result = await this.pool.query<DeploymentRow>(
      `SELECT id, project_id, environment, commit_sha, artifact_digest, status, promoted_from_deployment_id
       FROM deployments WHERE id = $1`,
      [deploymentId],
    );
    if (!result.rows[0]) throw new Error('NOT_FOUND');
    const deployment = this.mapDeployment(result.rows[0]);
    await this.assertProjectMember(userId, deployment.projectId);
    return deployment;
  }

  private async recordAudit(
    userId: string,
    projectId: string,
    action: string,
    deploymentId: string,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO audit_events (project_id, actor_user_id, action, deployment_id)
       VALUES ($1, $2, $3, $4)`,
      [projectId, userId, action, deploymentId],
    );
  }

  private mapRepository(row: RepositoryRow): RepositoryConnection {
    return {
      id: row.id,
      projectId: row.project_id,
      provider: row.provider,
      owner: row.owner,
      name: row.name,
      defaultBranch: row.default_branch,
    };
  }

  private mapDeployment(row: DeploymentRow): Deployment {
    return {
      id: row.id,
      projectId: row.project_id,
      environment: row.environment,
      commitSha: row.commit_sha,
      artifactDigest: row.artifact_digest,
      status: row.status,
      ...(row.promoted_from_deployment_id
        ? { promotedFromDeploymentId: row.promoted_from_deployment_id }
        : {}),
    };
  }
}

const allowedTransitions: Record<DeploymentStatus, readonly DeploymentStatus[]> = {
  pending: ['running', 'failed'],
  running: ['succeeded', 'failed'],
  succeeded: [],
  failed: ['pending'],
  rolled_back: [],
};

function isAllowedTransition(from: DeploymentStatus, to: DeploymentStatus): boolean {
  return allowedTransitions[from].includes(to);
}
