# Implementation Plan

Status: First-slice implementation complete — Next.js/Supabase integration is installed and validated; environment-dependent checks and production hardening remain pending.

This document is the execution plan for the first production-style vertical slice. Work should proceed in order, with tests and documentation completed at each gate.

## Latest verification status

- [x] `pnpm format:check`
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm test` — 7 API tests passing.
- [x] `pnpm build` — API and web builds passing.
- [ ] Docker Compose health/migration verification — Docker unavailable in the current environment.
- [ ] Live HTTP smoke test — sandbox does not permit binding local TCP ports.
- [ ] Browser E2E/accessibility tests — Playwright has not been installed yet.

## ShipFlow implementation status

- [x] Shared repository, deployment, and audit contracts.
- [x] Repository registration endpoint with tenant authorization.
- [x] Staging-only deployment creation with commit SHA and immutable artifact digest validation.
- [x] Explicit deployment state machine: pending → running → succeeded/failed, failed → pending retry.
- [x] Production promotion only from a successful staging deployment, preserving commit/artifact identity.
- [x] Audit events for deployment creation, status changes, and promotion.
- [x] PostgreSQL repository methods and migration tables for repositories, deployments, and audit events.
- [x] 7 API tests covering promotion rules and cross-tenant access.
- [x] Next.js App Router shell with Supabase SSR/browser client helpers and session refresh middleware.
- [ ] React release dashboard.
- [ ] RabbitMQ worker and durable job processing.
- [ ] GitHub webhook and commit status integration.
- [ ] OpenAPI-generated client and compatibility checks.

## Scope of the first release

Build Project 1, a multi-tenant project-management SaaS foundation:

- User registration/sign-in with secure session handling.
- Organization creation and membership.
- Project creation and listing.
- Backend API with PostgreSQL persistence.
- React frontend using a generated/shared API contract.
- Local PostgreSQL and Redis through Docker Compose.
- CI checks for formatting, linting, types, unit tests, integration tests, and build.
- Development deployment preparation; staging/production deployment follows after the local slice is accepted.

RabbitMQ, Kafka, and Spark are planned, but intentionally deferred until the application has a stable transactional and testing foundation. RabbitMQ will be introduced first for background jobs, Kafka for replayable domain events, and Spark for analytics.

## Proposed stack

- Workspace: pnpm monorepo.
- Frontend: React with Vite and TypeScript.
- Backend: Node.js TypeScript HTTP API using Fastify.
- Database: PostgreSQL with a migration-based data access layer.
- Cache: Redis.
- Contract: OpenAPI schema with generated TypeScript client/types.
- Tests: Vitest for unit/integration tests and Playwright for browser E2E tests.
- Local runtime: Docker Compose for PostgreSQL and Redis.
- CI: GitHub Actions.
- Deployment target: container image in ECR, initially deployed to ECS/Fargate.
- Infrastructure: Terraform under `infra/terraform`; no cloud credentials committed.

If a dependency is unavailable in the environment, installation will be requested or documented before implementation continues.

## Repository plan

```text
fullstack-platform/
  apps/
    web/                   React frontend
    api/                   Fastify API
  packages/
    contracts/             OpenAPI schemas and generated client
    config/                shared TypeScript/tooling configuration
  infra/
    docker-compose.yml      local PostgreSQL and Redis
    terraform/              AWS infrastructure plan
  tests/
    e2e/                   Playwright browser tests
  .github/workflows/       validation and deployment workflows
  docs/
    adr/                   architecture decisions
    runbooks/              operational procedures
  package.json
  pnpm-workspace.yaml
```

## Execution steps and gates

### Step 1 — Tooling and workspace

- [x] Confirm Node.js and package manager availability; Docker and Git are unavailable in the current environment.
- [x] Install only required project tools: user-local Node.js 22 and pnpm 9.
- [x] Create the monorepo and workspace scripts.
- [x] Configure strict TypeScript, formatting, linting, and build validation.
- [x] Add the root README and local setup instructions.
- [x] Gate: dependencies install and typecheck/tests/build pass in this environment.

Tests:

- [x] TypeScript configuration is validated by a successful typecheck.
- [x] Formatting and lint scripts pass from the repository root.
- [x] Workspace scripts run from the repository root.

### Step 2 — Local infrastructure and configuration

- [x] Add PostgreSQL and Redis services to Docker Compose.
- [x] Add health checks and persistent development volumes.
- [x] Add environment schema validation with safe example values.
- [x] Add database migration and seed SQL.
- [ ] Gate: run containers and migration successfully; Docker is unavailable in the current environment.

Tests:

- [ ] PostgreSQL health/readiness check — pending Docker.
- [ ] Redis connectivity check — pending Docker and Redis client integration.
- [ ] Migration applies to an empty database — pending Docker/PostgreSQL.
- [x] Seed is repeatable through `ON CONFLICT DO NOTHING`.
- [x] Missing/invalid environment variables fail fast.

### Step 3 — Shared contracts

- [x] Define contract types for health, organizations, and projects.
- [x] Define request/response validation and stable error responses.
- [ ] Generate the frontend client from a formal OpenAPI document.
- [ ] Add contract compatibility validation to CI.
- [ ] Gate: replace the current shared types with generated client output.

Tests:

- [x] Valid requests pass schema validation.
- [x] Invalid body, path, and query inputs return consistent 4xx errors.
- [ ] Generated client compiles against the API types.
- [ ] Breaking contract changes fail CI.

### Step 4 — Backend vertical slice

- [x] Implement health endpoint.
- [ ] Implement real user/session flow; current demo uses a temporary `x-user-id` header.
- [x] Implement organization membership and authorization checks.
- [x] Implement project create/list endpoints.
- [x] Add PostgreSQL repository and migration.
- [ ] Add structured logging and request correlation IDs.
- [x] Gate: API tests prove an authenticated user can access only authorized organization projects.

Tests:

- [x] API tests for health, validation, authentication, project creation/listing, and tenant isolation.
- [ ] Integration tests against PostgreSQL for migrations and repositories — pending Docker.
- [ ] Unit tests for separate domain/service modules — pending service extraction.
- [ ] Authentication tests for missing, expired, and invalid real sessions — pending auth implementation.
- [ ] Idempotency tests for retryable create operations — pending idempotency design.

### Step 5 — Frontend vertical slice

- [ ] Add real sign-in and session state; current slice uses a demo user header.
- [x] Add organization/project pages.
- [x] Add basic loading/error/empty states.
- [x] Use shared contract types.
- [x] Add accessible form labels and error messaging.
- [ ] Gate: browser workflow against persisted Supabase/PostgreSQL data — pending configured Supabase project and Playwright.

Tests:

- [ ] Component tests for form validation and error states.
- [ ] Client tests for successful and failed API responses.
- [ ] Playwright E2E: sign in → create organization → create project → list project.
- [ ] Playwright E2E: unauthorized organization/project access is denied.
- [ ] Accessibility smoke test for the main workflow.

### Step 6 — CI and artifact workflow

- [x] Add pull-request validation: install, format check, lint, typecheck, tests, and build.
- [ ] Build API/web artifacts with commit SHA metadata.
- [ ] Produce an immutable container image and SBOM when Docker is available.
- [ ] Add dependency and secret scanning.
- [x] Add staging/prod approval and deployment metadata planning to the roadmap.
- [ ] Gate: CI blocks a broken test, type error, contract break, or vulnerable secret.

Tests:

- [x] CI workflow runs on a clean checkout configuration.
- [ ] PostgreSQL/Redis service containers pass health checks — pending hosted CI execution.
- [ ] Test reports and coverage are uploaded.
- [ ] Artifact contains the source commit SHA.
- [ ] A failed deployment does not mark the release successful.

### Step 7 — Documentation and handoff

- [x] Write architecture ADR for monorepo, PostgreSQL, API contract, and auth limitation.
- [x] Write local development guide.
- [x] Write migration and rollback runbook.
- [x] Update this plan with completed/pending status.
- [x] Record known limitations and next implementation slice.
- [ ] Gate: another developer can run the full persisted workflow — pending Docker/Playwright.

## Repository and commit tracking

- [x] Initialize `shipflow-app` as the product repository and use small conventional commits.
- [x] Create the `shipflow-infra` repository skeleton; keep secrets and Terraform state outside Git.
- [ ] Create `shipflow-workers` only after RabbitMQ/Kafka/Spark has an independent runtime, release cadence, or scaling requirement.
- [ ] Protect `main`, enable Vercel preview deployments, and promote the same tested deployment to staging/production.
- [ ] Tag the first public demo as `v0.1.0`.

## Test strategy

Every feature follows this order:

1. Unit test pure validation, domain logic, and authorization rules.
2. Integration test repositories, migrations, Redis interactions, and message boundaries.
3. API/contract test request and response compatibility.
4. End-to-end test the user workflow in a real browser.
5. Load test only after correctness and observability are established.
6. Security test tenant isolation, authentication, authorization, input validation, and secret handling.

Minimum initial coverage is not a vanity percentage. The required paths are authentication, authorization, tenant isolation, project creation/listing, migrations, contract validation, and the main browser workflow.

## Definition of complete for the first slice

- [ ] All Step 1–7 gates pass.
- [ ] The full test suite passes from a clean checkout.
- [ ] PostgreSQL migrations and seed are documented.
- [ ] No secrets or local database files are committed.
- [ ] The frontend/backend contract is generated and checked in the intended form.
- [ ] The deployment artifact identifies its commit SHA.
- [ ] The roadmap and this plan show accurate completed/pending status.

## Latest implementation update — Next.js and Supabase

- [x] Replaced the Vite frontend entrypoint with a Next.js App Router application.
- [x] Added `@supabase/supabase-js` and `@supabase/ssr` using the workspace package manager.
- [x] Added server-side and browser-side Supabase clients.
- [x] Added middleware session refresh using `supabase.auth.getUser()`.
- [x] Added a safe [apps/web/.env.local.example](./apps/web/.env.local.example); real Supabase values must remain in local/Vercel environment settings.
- [x] Added a server-rendered projects dashboard that reads the authenticated user's projects.
- [x] Verified formatting, linting, typechecking, tests, API build, and Next.js production build.
- [ ] Configure the Supabase project schema, Auth provider, RLS policies, and Vercel environment variables.
- [ ] Add sign-in/sign-out UI and connect ShipFlow's organization membership model to `auth.users`.

## Repository creation update

- [x] Initialized the root application repository locally as `shipflow-app`.
- [x] Created and initialized the sibling `shipflow-infra` repository skeleton.
- [x] Documented the staging-to-production commit/artifact promotion boundary.
- [x] Created initial commits in both local repositories.
- [ ] Create/connect the corresponding remote GitHub repositories — GitHub connector requested; pending activation/authentication.
- [ ] Create focused feature branches and commit the next implementation slices using conventional commits.
- [ ] Add Terraform modules only when the first hosted resources are ready to be managed.
