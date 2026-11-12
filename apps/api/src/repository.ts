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

export type Membership = { userId: string; organizationId: string; role: Role };

export interface Repository {
  findUser(userId: string): Promise<User | undefined>;
  createOrganization(userId: string, name: string): Promise<Organization>;
  listOrganizations(userId: string): Promise<Organization[]>;
  createProject(userId: string, organizationId: string, name: string): Promise<Project>;
  listProjects(userId: string, organizationId: string): Promise<Project[]>;
  createRepository(userId: string, input: CreateRepositoryRequest): Promise<RepositoryConnection>;
  createDeployment(userId: string, input: CreateDeploymentRequest): Promise<Deployment>;
  listDeployments(userId: string, projectId: string): Promise<Deployment[]>;
  updateDeploymentStatus(
    userId: string,
    deploymentId: string,
    status: DeploymentStatus,
  ): Promise<Deployment>;
  promoteDeployment(userId: string, deploymentId: string): Promise<Deployment>;
  listAuditEvents(userId: string, projectId: string): Promise<AuditEvent[]>;
}

export class InMemoryRepository implements Repository {
  private readonly users = new Map<string, User>();
  private readonly organizations = new Map<string, Organization>();
  private readonly memberships: Membership[] = [];
  private readonly projects = new Map<string, Project>();
  private readonly repositories = new Map<string, RepositoryConnection>();
  private readonly deployments = new Map<string, Deployment>();
  private readonly auditEvents: AuditEvent[] = [];

  constructor() {
    this.users.set('demo-user', { id: 'demo-user', email: 'demo@example.com' });
    this.users.set('other-user', { id: 'other-user', email: 'other@example.com' });
  }

  async findUser(userId: string): Promise<User | undefined> {
    return this.users.get(userId);
  }

  async createOrganization(userId: string, name: string): Promise<Organization> {
    const organization = { id: crypto.randomUUID(), name, role: 'owner' as const };
    this.organizations.set(organization.id, organization);
    this.memberships.push({ userId, organizationId: organization.id, role: 'owner' });
    return organization;
  }

  async listOrganizations(userId: string): Promise<Organization[]> {
    return this.memberships
      .filter((membership) => membership.userId === userId)
      .map((membership) => this.organizations.get(membership.organizationId))
      .filter((organization): organization is Organization => organization !== undefined);
  }

  async createProject(userId: string, organizationId: string, name: string): Promise<Project> {
    await this.assertMember(userId, organizationId);
    const project = { id: crypto.randomUUID(), organizationId, name };
    this.projects.set(project.id, project);
    return project;
  }

  async listProjects(userId: string, organizationId: string): Promise<Project[]> {
    await this.assertMember(userId, organizationId);
    return [...this.projects.values()].filter(
      (project) => project.organizationId === organizationId,
    );
  }

  private async assertMember(userId: string, organizationId: string): Promise<void> {
    if (
      !this.memberships.some(
        (item) => item.userId === userId && item.organizationId === organizationId,
      )
    ) {
      throw new Error('FORBIDDEN');
    }
  }

  async createRepository(
    userId: string,
    input: CreateRepositoryRequest,
  ): Promise<RepositoryConnection> {
    await this.assertProjectMember(userId, input.projectId);
    const repository = { id: crypto.randomUUID(), ...input };
    this.repositories.set(repository.id, repository);
    return repository;
  }

  async createDeployment(userId: string, input: CreateDeploymentRequest): Promise<Deployment> {
    await this.assertProjectMember(userId, input.projectId);
    if (input.environment !== 'staging') throw new Error('DEPLOYMENT_TARGET_INVALID');
    const deployment = { id: crypto.randomUUID(), ...input, status: 'pending' as const };
    this.deployments.set(deployment.id, deployment);
    this.recordAudit(userId, deployment.projectId, 'deployment.created', deployment.id);
    return deployment;
  }

  async listDeployments(userId: string, projectId: string): Promise<Deployment[]> {
    await this.assertProjectMember(userId, projectId);
    return [...this.deployments.values()].filter(
      (deployment) => deployment.projectId === projectId,
    );
  }

  async updateDeploymentStatus(
    userId: string,
    deploymentId: string,
    status: DeploymentStatus,
  ): Promise<Deployment> {
    const deployment = await this.findDeploymentForMember(userId, deploymentId);
    if (!isAllowedTransition(deployment.status, status))
      throw new Error('INVALID_DEPLOYMENT_TRANSITION');
    const updated = { ...deployment, status };
    this.deployments.set(deploymentId, updated);
    this.recordAudit(userId, updated.projectId, `deployment.${status}`, updated.id);
    return updated;
  }

  async promoteDeployment(userId: string, deploymentId: string): Promise<Deployment> {
    const staging = await this.findDeploymentForMember(userId, deploymentId);
    if (staging.environment !== 'staging' || staging.status !== 'succeeded') {
      throw new Error('DEPLOYMENT_NOT_PROMOTABLE');
    }
    const production = {
      id: crypto.randomUUID(),
      projectId: staging.projectId,
      environment: 'production' as const,
      commitSha: staging.commitSha,
      artifactDigest: staging.artifactDigest,
      status: 'pending' as const,
      promotedFromDeploymentId: staging.id,
    };
    this.deployments.set(production.id, production);
    this.recordAudit(userId, production.projectId, 'deployment.promoted', production.id);
    return production;
  }

  async listAuditEvents(userId: string, projectId: string): Promise<AuditEvent[]> {
    await this.assertProjectMember(userId, projectId);
    return this.auditEvents.filter((event) => event.projectId === projectId);
  }

  private async assertProjectMember(userId: string, projectId: string): Promise<Project> {
    const project = this.projects.get(projectId);
    if (!project) throw new Error('NOT_FOUND');
    await this.assertMember(userId, project.organizationId);
    return project;
  }

  private async findDeploymentForMember(userId: string, deploymentId: string): Promise<Deployment> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) throw new Error('NOT_FOUND');
    await this.assertProjectMember(userId, deployment.projectId);
    return deployment;
  }

  private recordAudit(
    userId: string,
    projectId: string,
    action: string,
    deploymentId: string,
  ): void {
    this.auditEvents.push({
      id: crypto.randomUUID(),
      projectId,
      actorUserId: userId,
      action,
      deploymentId,
      occurredAt: new Date().toISOString(),
    });
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
