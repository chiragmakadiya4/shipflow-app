# Full-Stack Industry Roadmap

This roadmap is designed for a TypeScript/React developer who already understands JavaScript, React, CI/CD, and AWS. The goal is to build eight production-style systems, each adding a real engineering capability.

## Target architecture

Use an application monorepo so the frontend, backend, contracts, and shared tooling evolve together. Keep infrastructure isolated from application runtime code. This gives you one place to develop and test the product without allowing Terraform, cloud credentials, or deployment code to leak into browser/server packages.

```text
apps/
  web/                 React application
  api/                 HTTP API/BFF
  worker/              background jobs and event consumers
  admin/               internal operations UI
packages/
  contracts/           OpenAPI schemas, DTOs, generated clients
  ui/                  shared accessible React components
  config/              shared TypeScript, ESLint, Prettier, Vitest config
  observability/       logging, tracing, metrics helpers
  auth/                shared auth/session types and policies
infra/
  terraform/           AWS infrastructure by environment
  helm/                Kubernetes deployment manifests, if needed later
  environments/        dev, staging, production configuration

apps-and-infra-repositories/
  product-platform/    the application monorepo shown above
  platform-infra/      optional separate repository for shared AWS/network/platform resources
```

For your first projects, use one repository with `apps/`, `packages/`, and `infra/` at the root. As the team grows, move shared/platform infrastructure to a separate `platform-infra` repository while keeping application-specific deployment modules close to the application. The frontend and backend should remain in the same application monorepo because they share contracts and need coordinated changes.

Prefer a modular monolith first. Split services only when there is a clear scaling, ownership, deployment, or reliability reason.

## Recommended repository layout

```text
product-platform/
  apps/
    web/               frontend
    api/               backend API
    worker/            background jobs
  packages/
    contracts/         shared API schemas and generated clients
    ui/                shared frontend components
    config/            shared tooling configuration
  infra/
    terraform/
      modules/         reusable infrastructure modules
      environments/    dev, staging, production stacks
  .github/workflows/   CI and deployment workflows
  Dockerfile.api
  Dockerfile.web
  package.json
  pnpm-workspace.yaml
```

Do not put environment secrets in this repository. Store them in AWS Secrets Manager or SSM Parameter Store, and let the deployment role read only the secrets required by that environment.

## Messaging, caching, and data-processing platform

Use these technologies for different jobs:

| Technology   | Primary responsibility        | Use it for                                                                                              | Do not use it for                                             |
| ------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Redis        | Low-latency state             | Cache, sessions, rate limits, distributed locks, short-lived counters, presence                         | The primary source of durable business data                   |
| RabbitMQ     | Work queues and task delivery | Email jobs, image processing, payment retries, commands requiring acknowledgement and routing           | Long-term event history or high-volume analytics streams      |
| Kafka        | Durable event streaming       | Domain events, CDC, audit/event history, replayable integrations, high-throughput consumers             | A simple one-off background task that RabbitMQ handles better |
| Apache Spark | Distributed data processing   | Large batch ETL, event aggregation, historical analytics, feature generation, streaming transformations | Request/response APIs or small background jobs                |

Recommended flow:

```text
API --> PostgreSQL        transactional source of truth
  |
  +--> outbox --> Kafka   durable domain events and integrations
  |
  +--> RabbitMQ           operational jobs requiring acknowledgement/retry
  |
  +--> Redis              cache, session, rate limit, short-lived state

Kafka --> object storage/data lake --> Spark --> analytics/read models --> API/dashboard
```

Do not introduce RabbitMQ and Kafka into every service automatically. Start with RabbitMQ for operational jobs, add Kafka when multiple independent consumers need durable/replayable events, and add Spark when the volume or transformation complexity justifies distributed processing. PostgreSQL remains the transactional authority; Kafka and Spark-derived models are downstream representations.

## The eight portfolio projects

### 1. Production-ready SaaS foundation

- Multi-tenant user, organization, role, and permission model.
- React web app, TypeScript API, PostgreSQL, Redis, object storage.
- Email verification, password reset, session management, audit log.
- OpenAPI contract and generated frontend client.
- AWS deployment with domain, TLS, secrets, database backups, and migrations.

### 2. E-commerce/order platform

- Product catalog, inventory, cart, checkout, orders, refunds, and admin workflows.
- Idempotent payment/order APIs and transactional outbox.
- Background jobs for email, inventory reconciliation, and failed payments.
- RabbitMQ workers for operational jobs; publish order/payment domain events through an outbox to Kafka when multiple consumers need them.
- Search, pagination, filtering, rate limits, and caching.

### 3. Real-time collaboration product

- Projects, comments, presence, notifications, and live updates.
- WebSockets or Server-Sent Events with reconnect and authorization handling.
- Optimistic UI, conflict handling, and durable notification history.

### 4. File/media processing platform

- Direct-to-S3 uploads using presigned URLs.
- Virus/type/size validation, metadata, thumbnail or document processing workers.
- Async status tracking, retries, dead-letter handling, and signed downloads.

### 5. Analytics and reporting system

- Event ingestion API, schema versioning, aggregation jobs, and dashboards.
- Separate transactional and analytical read models.
- Export to CSV/JSON, scheduled reports, and tenant-aware data isolation.
- Consume versioned Kafka events into object storage and use Spark for batch aggregation and analytical read models.

### 6. Distributed workflow/orchestration system

- Durable jobs with retries, timeouts, backoff, idempotency, and compensation.
- Workflow state machine, operator dashboard, replay support, and audit trail.
- Use queues/events before introducing microservices.
- Use RabbitMQ for command execution and retries; use Kafka for durable workflow lifecycle events and replay.

### 7. Developer platform / internal tools product

- Service catalog, environment variables, deployment history, feature flags, and approvals.
- GitHub webhook integration, preview environments, and release status.
- Demonstrates platform engineering, RBAC, and operational UX.

### 8. High-scale multi-region application

- Read replicas or partitioning, CDN, cache strategy, asynchronous event processing.
- Load testing, failure injection, disaster recovery, RTO/RPO documentation.
- Blue/green or canary deployment and regional failover runbook.
- Evaluate Kafka partitioning, Redis cache strategy, and Spark streaming/batch jobs under realistic load.

## Reusable deployment pipeline

Create one template and reuse it for every project:

1. Validate: formatting, linting, type checking, unit tests, dependency audit.
2. Build: reproducible Docker images and frontend assets; generate SBOM.
3. Contract checks: OpenAPI compatibility, database migration checks, API/client generation.
4. Security: secret scanning, SAST, container scan, dependency/license policy.
5. Preview: deploy an ephemeral environment for pull requests when practical.
6. Staging: deploy immutable artifacts, run migrations safely, smoke and integration tests.
7. Production approval: require review for production promotion and sensitive migrations.
8. Release: blue/green or canary rollout, health checks, automatic rollback, and release notes.

Every pipeline should publish test results, coverage, image digest, migration status, deployment metadata, and links to logs/traces.

## Deploying one exact commit to staging and production

Build once and promote the same immutable artifact. Never rebuild from a branch when promoting to production, because a rebuild can produce a different dependency lock, image, or generated asset.

```text
commit 8f31c2a
    |
    +--> CI checks --> Docker image tagged with 8f31c2a and pushed to ECR
                         |
                         +--> deploy image digest to staging
                         |
                         +--> staging tests and approval
                         |
                         +--> deploy the same image digest to production
```

Recommended flow:

1. A pull request merges into `main`; CI creates an image using the merge commit SHA.
2. The image is pushed to ECR with an immutable tag such as `api-8f31c2a` and recorded by digest.
3. The staging deployment receives the commit SHA or image digest as an input.
4. Staging runs migrations, smoke tests, integration tests, and manual QA.
5. A production workflow accepts the exact SHA/digest as a required input.
6. GitHub Actions uses protected `staging` and `production` environments with separate AWS roles and approvals.
7. Production deploys that same digest, then performs health checks and canary/blue-green rollout.
8. Rollback means selecting the previous known-good image digest, not rebuilding old source code.

Use branch and tag rules like this:

- `main`: integration branch; every successful merge may deploy to staging.
- `release/<version>` or an annotated tag such as `v1.4.0`: optional release marker for business visibility.
- Production: promotion of a tested staging artifact, with approval; production should not deploy arbitrary branch heads.
- Deployment record: store commit SHA, image digests, database migration version, actor, timestamp, and environment.

Separate application deployment from infrastructure deployment. Terraform changes should have their own plan/apply workflow, state backend, locking, approvals, and least-privilege AWS role. An application deployment should consume existing infrastructure and should not run unrestricted Terraform.

## Frontend/backend sharing rules

- Share contracts, types, validation schemas, and generated clients; do not share server internals with the browser.
- Keep `contracts` framework-neutral. Generate the API client from OpenAPI or use a type-safe RPC approach consistently.
- Share design-system components through `packages/ui`; keep product-specific UI inside each app.
- Share auth claims and permission types, but enforce authorization on the backend.
- Use one source of truth for enums and error codes.
- Version breaking API changes and support old clients during rollout.
- Avoid importing database models, secrets, Node-only modules, or backend service code into frontend packages.

## Engineering standards to add across projects

- Testing pyramid: unit, integration, contract, end-to-end, and load tests.
- Secure defaults: least-privilege IAM, validation, CSRF/XSS protection, secure headers, encryption, audit logs, and dependency updates.
- Reliability: timeouts, retries with jitter, idempotency keys, circuit breakers where appropriate, health/readiness checks.
- Observability: structured logs, correlation IDs, OpenTelemetry traces, RED metrics, dashboards, and actionable alerts.
- Data: migrations, backup/restore drills, retention policy, PII classification, tenant isolation, and seed data.
- Documentation: ADRs, architecture diagram, threat model, API docs, runbooks, and local development guide.
- Developer experience: one-command local setup, containers, seeded database, pre-commit checks, and fast feedback.

## AWS reference architecture

Start with managed services and a container platform. The first version does not need Kubernetes; ECS Fargate or App Runner keeps operations approachable while still teaching production deployment. Introduce EKS only when you have a concrete Kubernetes learning or operational reason.

| Concern         | Starting AWS choice                                | Later-scale option               | Key practice                                                         |
| --------------- | -------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------- |
| Web delivery    | CloudFront + S3 or Next.js container               | Edge/ISR strategy                | Cache public assets; never cache authenticated responses incorrectly |
| API and workers | ECS Fargate behind ALB                             | EKS                              | Separate API and worker autoscaling policies                         |
| PostgreSQL      | RDS PostgreSQL Multi-AZ                            | Read replicas, Aurora PostgreSQL | Automated backups, PITR, connection pooling                          |
| Redis           | ElastiCache Redis                                  | Cluster mode/replicas            | Set eviction policy deliberately; monitor memory and hit rate        |
| RabbitMQ        | Amazon MQ for RabbitMQ or managed provider         | Clustered broker setup           | Monitor queue depth, consumer lag, DLQ volume                        |
| Kafka           | Amazon MSK Serverless/provisioned or managed Kafka | Partitioned multi-AZ cluster     | Use schemas, retention, consumer lag alerts, ACLs                    |
| Data lake/Spark | S3 + Glue/Athena first                             | EMR Serverless / managed Spark   | Partition by date/tenant; use Parquet and lifecycle rules            |
| Files           | S3                                                 | Cross-region replication         | Encrypt, use lifecycle policies, presigned upload/download URLs      |
| Secrets         | Secrets Manager / Parameter Store                  | —                                | Rotate and scope access by environment                               |
| Observability   | CloudWatch + OpenTelemetry collector               | Grafana/Tempo/Prometheus         | Correlate logs, traces, metrics, and deployments                     |

Keep separate AWS accounts for development, staging, and production when possible. At minimum, use separate VPCs, IAM roles, databases, queues, buckets, and secrets for each environment. Production must never share data or credentials with lower environments.

## Data, events, and ownership rules

These rules prevent the most common distributed-system failures:

- PostgreSQL owns transactional writes. Consumers never write directly to another service's database.
- An API transaction writes business data and an `outbox_event` in the same PostgreSQL transaction. A publisher sends that event to Kafka only after commit.
- Every message includes `eventId`, `eventType`, `schemaVersion`, `occurredAt`, `aggregateId`, `tenantId`, and a correlation/trace ID.
- Assume at-least-once delivery. Consumers must be idempotent and persist processed event IDs or use an idempotency key.
- Use a schema registry or versioned JSON Schema/Avro/Protobuf contracts. Make additive changes first; remove fields only after consumers migrate.
- RabbitMQ DLQ messages require an operator workflow: inspect, fix the root cause, then replay deliberately. Do not endlessly retry poison messages.
- Kafka topics need an explicit owner, retention policy, partition key, expected consumers, PII classification, and replay procedure.
- Analytics data is read-only derived data. If it is wrong, rebuild it from retained events/source data rather than manually editing it.

## Database design and migration policy

- Use one PostgreSQL database initially, with schemas/modules such as `identity`, `organizations`, `projects`, and `billing`; this supports a modular monolith without premature microservices.
- Put a tenant/organization key on every tenant-owned table, enforce it in queries, and index it with the access pattern.
- Use database migrations in source control and run them once as a controlled deployment job—not independently in every API container.
- Make destructive changes expand/contract: add a nullable column or new table, deploy code that writes both forms, backfill asynchronously, switch reads, then remove the old field in a later release.
- Define row retention and deletion behaviour for business data, audit data, files, events, and analytics separately.
- Test backup restoration on a schedule. A backup is only credible after a successful restore test.

## Security baseline

- Use GitHub Actions OIDC to assume short-lived AWS IAM roles; do not store long-lived AWS keys in GitHub secrets.
- Apply least privilege per workload: API, worker, migration job, CI, staging deployer, and production deployer use distinct roles.
- Validate input at API boundaries; enforce authorization server-side for every resource access.
- Protect browser sessions with secure, HttpOnly, SameSite cookies; add CSRF protection if cookie-based authentication is used.
- Encrypt data in transit and at rest; classify PII and restrict it from logs, Kafka payloads, and analytics exports unless required.
- Add dependency, secret, SAST, container, and infrastructure-as-code scans to CI; define a process for severity-based remediation.
- Create a lightweight threat model for each project: assets, entry points, trust boundaries, abuse cases, and mitigations.

## Operational readiness and SLOs

For each deployable service, write a one-page operational contract:

- Owner, dependency list, dashboard, alerts, runbook, rollback method, and on-call escalation path.
- SLIs: request success rate, latency, saturation, RabbitMQ queue age/depth, Kafka consumer lag, job failure rate, and database connection usage.
- Example starter SLO: 99.9% successful API requests monthly, excluding planned maintenance. Define an error budget and stop feature delivery temporarily if reliability repeatedly spends it.
- Alerts should be symptom-led: users cannot sign in, order creation is failing, queue age is growing, or consumer lag breaches a threshold. Avoid alerting on every CPU fluctuation.
- Run game days: kill a worker, fail a consumer, restore a database copy, replay an event, exhaust Redis memory, and roll back a production artifact.

## Cost and complexity guardrails

- Use local containers for Redis, RabbitMQ, Kafka, PostgreSQL, and optional Spark development; do not keep expensive cloud clusters running for portfolio demos.
- Begin with a single availability zone in development; use Multi-AZ only in staging/production when the learning objective requires it.
- Use S3 lifecycle rules, log retention limits, resource tags, AWS Budgets, and cost anomaly alerts from day one.
- Make every new managed service justify itself in an ADR: problem, alternatives, operational cost, failure mode, and removal path.
- Do not adopt microservices, EKS, Kafka, or Spark merely because they are industry tools. Demonstrate the decision triggers and trade-offs—that is the senior-level skill.

## Suggested delivery milestones

| Milestone               | Deliverable                                    | Evidence to publish                                        |
| ----------------------- | ---------------------------------------------- | ---------------------------------------------------------- |
| M1: Developer platform  | Monorepo, local stack, CI, contract package    | Setup video/GIF, architecture diagram, green CI            |
| M2: SaaS vertical slice | Auth, tenancy, project CRUD, PostgreSQL        | E2E test, migration, deployed development URL              |
| M3: Async reliability   | RabbitMQ worker, DLQ, idempotent job handling  | Failure/retry demonstration and runbook                    |
| M4: Event backbone      | PostgreSQL outbox and Kafka consumer           | Replay demo, schema-evolution example, lag dashboard       |
| M5: Data platform       | S3 lake + Spark batch report                   | Partitioned dataset, job metrics, reproducible report      |
| M6: Release engineering | Immutable promotion from staging to production | Deployment record, approval gate, rollback demonstration   |
| M7: Resilience          | Load test and recovery exercise                | Before/after benchmark, restore/replay results, postmortem |

Each milestone should end with a small, working release. Avoid building all infrastructure first; infrastructure earns its place when a running feature needs it.

## Implementation order

The detailed pre-implementation plan, test strategy, execution gates, and status tracking are in [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md). Do not begin application implementation until the first-slice scope and stack in that document are reviewed.

### Phase 0 — Foundation

- [ ] Confirm the stack: React/Next.js, Node.js API, PostgreSQL as the primary database, Redis for cache/session/rate-limit use cases, a queue, Docker, Terraform, and GitHub Actions.
- [ ] Create the monorepo and package boundaries.
- [ ] Add TypeScript strict mode, linting, formatting, testing, commit hooks, and conventional commits.
- [ ] Add local Docker Compose for database, cache, and queue.
- [ ] Define environment/config validation and secret handling.
- [ ] Create the first CI pipeline and reusable workflow templates.
- [ ] Decide whether `infra/` starts in the application monorepo or in a separate `platform-infra` repository.
- [ ] Configure ECR image repositories and immutable image tagging by commit SHA.
- [ ] Configure protected GitHub `staging` and `production` environments with separate AWS IAM roles.
- [ ] Implement build-once/promote-same-artifact deployment workflows.
- [ ] Record deployment metadata and document rollback by image digest.

### Phase 1 — Project 1: SaaS foundation

- [ ] Implement auth, tenancy, RBAC, audit logging, and CRUD workflows.
- [ ] Define OpenAPI contracts and generate the web client.
- [ ] Add PostgreSQL migrations, integration tests, and E2E tests.
- [ ] Deploy dev/staging/production infrastructure with Terraform.
- [ ] Add logs, traces, metrics, backups, alerts, and rollback.

### Phase 2 — Projects 2–4

- [ ] Build order/payment workflows with idempotency and outbox events.
- [ ] Add queues, workers, retries, dead-letter queues, and reconciliation jobs.
- [ ] Implement RabbitMQ exchanges, queues, acknowledgements, retry/backoff policy, and dead-letter queues.
- [ ] Implement the transactional outbox pattern from PostgreSQL to Kafka.
- [ ] Add real-time collaboration and authorization-aware subscriptions.
- [ ] Add presigned uploads and asynchronous media processing.

### Phase 3 — Projects 5–7

- [ ] Build event ingestion and analytical read models.
- [ ] Define Kafka topics, partitions, retention, consumer groups, schemas, and replay procedures.
- [ ] Add object-storage data lake layouts and Spark batch jobs for analytics.
- [ ] Add Spark Structured Streaming only after batch processing and event contracts are stable.
- [ ] Build a durable workflow engine with replay and operator controls.
- [ ] Build the developer platform with webhooks, preview environments, and approvals.
- [ ] Standardize dashboards, runbooks, incident workflow, and cost reporting.

### Phase 4 — Project 8 and scale validation

- [ ] Define SLOs, load profiles, RTO, RPO, and capacity assumptions.
- [ ] Run baseline, stress, soak, and failure-injection tests.
- [ ] Add CDN/cache/read scaling and tune database access patterns.
- [ ] Add canary or blue/green production releases.
- [ ] Perform restore, regional failure, rollback, and security exercises.

## Definition of done for every project

- [ ] README with architecture diagram and trade-offs.
- [ ] Local setup works from a clean checkout.
- [ ] CI blocks broken code and produces a deployable artifact.
- [ ] Infrastructure is reproducible and secrets are not committed.
- [ ] API contract and migration strategy are documented.
- [ ] Unit, integration, E2E, and appropriate load tests exist.
- [ ] Logs, traces, metrics, dashboards, and alerts are usable.
- [ ] Threat model, backup/restore plan, and incident runbook exist.
- [ ] A short postmortem or architecture decision record explains important choices.

## First implementation slice

Start with Project 1 and deliver one vertical slice: sign in, create an organization, create a project, list it in React, test it in CI, and deploy it to a development AWS environment. Then expand one capability at a time. This keeps the architecture grounded in working software instead of building a large empty platform.
