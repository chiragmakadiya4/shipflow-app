# ShipFlow — Deployment and Release Platform

ShipFlow is the flagship portfolio project for this repository. It is a multi-tenant platform for engineering teams to connect a repository, track commits, deploy an immutable artifact to staging, approve it, and promote the exact artifact to production.

## Why this project is resume-worthy

- Demonstrates product development, not only isolated technical demos.
- Proves frontend/backend contract sharing, PostgreSQL modeling, authorization, queues, deployment automation, and observability in one coherent system.
- Directly exercises the requirement to deploy a specific commit safely across staging and production.
- Creates strong GitHub evidence: architecture decisions, CI runs, deployment records, failure demos, dashboards, and runbooks.

## First release

1. Organization and project management.
2. Repository registration with default branch and provider metadata.
3. Environment management for `staging` and `production`.
4. Deployment creation from a commit SHA and immutable artifact digest.
5. Deployment lifecycle: pending, running, succeeded, failed, rolled back.
6. Production promotion only from a successful staging deployment.
7. Audit trail showing who promoted which commit and artifact.

## Planned architecture

```text
React web app
      ↓ shared contract/client
Fastify API → PostgreSQL (projects, environments, deployments, audit)
      ├── Redis (cache, locks, rate limits)
      ├── RabbitMQ (deployment jobs and retries)
      └── Kafka (deployment events and integrations)

Worker → container registry / deployment provider
Kafka → object storage → Spark → release analytics
```

The first implementation uses an in-memory repository for deterministic API tests and a PostgreSQL adapter for persistence. Deployment execution is initially represented by a state machine; real AWS/GitHub execution is added after the contract and authorization behavior are stable.

## Repository and deployment model

Use the repository split described in [REPOSITORY_STRATEGY.md](./REPOSITORY_STRATEGY.md): keep the product in `shipflow-app`, move Terraform/provider configuration to `shipflow-infra`, and create `shipflow-workers` only when worker scaling or release ownership justifies it. Use protected `main`, pull-request Vercel previews, a staging environment, and production promotion of the exact tested deployment.

## Success criteria

- A user can create a project and register a repository.
- A commit can be deployed to staging with an immutable image digest.
- Only a successful staging deployment can be promoted to production.
- A failed deployment is retryable and does not become promotable.
- A user from another organization cannot view or mutate deployments.
- Every state transition is auditable and traceable to a commit, artifact, actor, and timestamp.

## Personal-demo deployment choices

- Web/UI: migrate the current Vite app to Next.js App Router and deploy it to Vercel Hobby.
- Database: use Supabase free PostgreSQL for the hosted demo; keep local PostgreSQL and migrations compatible with the same schema.
- Cache/rate limits: use Upstash Redis only for cache, rate limiting, and idempotency; the product must still work if cache is unavailable.
- GitHub tracking: use a small allowlist of public repositories, server-side authenticated requests, pagination, ETags, caching, and exponential backoff.
- Scheduled sync: use Vercel Cron or a GitHub Actions schedule for bounded, resumable synchronization jobs.
- Async workers: use GitHub Actions initially; introduce RabbitMQ/Kafka/Spark as optional local or worker-repository profiles after the free demo is stable.

Known constraints: Vercel Functions are request-oriented and are not a WebSocket server, so the demo will use polling or a third-party realtime service. Public unauthenticated GitHub API requests are limited to 60 per hour, so synchronization must be cached and rate-aware. Hosted free databases may pause or have small storage/retention limits; the UI will show last-sync status and the project will include reseed instructions.

## Resume bullet after completion

> Built ShipFlow, a multi-tenant TypeScript deployment platform with PostgreSQL, Redis, RabbitMQ, Kafka, React, AWS, immutable commit-based releases, staging-to-production promotion, contract-tested APIs, and observable rollback workflows.

## Build order

- [x] Add repository, environment, deployment, and audit contracts.
- [x] Add project/repository/deployment/audit API endpoints.
- [x] Add deployment state machine with promotion rules.
- [x] Add PostgreSQL migrations and repository adapter; integration execution remains pending Docker.
- [ ] Add React release dashboard and deployment history.
- [ ] Add RabbitMQ deployment worker and retry/DLQ behavior.
- [ ] Add GitHub webhook and commit status integration.
- [ ] Add immutable ECR artifact promotion and staging/production workflows.
- [ ] Add Kafka deployment events and Spark release analytics.
- [ ] Add load, failure-injection, security, and end-to-end tests.
