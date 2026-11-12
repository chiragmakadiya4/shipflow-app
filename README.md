# Full-Stack Platform

This repository contains ShipFlow, a deployment and release platform built from the full-stack industry roadmap: a TypeScript React frontend, Fastify API, PostgreSQL persistence, Redis-ready local infrastructure, shared contracts, tests, and CI.

## Local setup

1. Install Node.js 22+ and pnpm 9+.
2. Run `pnpm install`.
3. Copy `.env.example` to `.env`.
4. Start PostgreSQL and Redis with `docker compose up -d`.
5. Run the migration with `DATABASE_URL=postgres://app:app@localhost:5432/platform pnpm db:migrate`.
6. Start the API with `DATABASE_URL=postgres://app:app@localhost:5432/platform pnpm --filter @fullstack/api dev`.
7. Start the web app with `pnpm --filter @fullstack/web dev`.

If `DATABASE_URL` is omitted, the API uses an in-memory repository for local demonstrations and tests. Production and staging must always configure PostgreSQL.

The managed execution environment used to create this project does not permit binding a local TCP port or running Docker, so the API smoke test and PostgreSQL/Redis integration checks must be run on a normal developer machine or CI runner.

## Verification commands

- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm check`

The current automated tests cover API health, authentication checks, organization/project creation, validation, and cross-tenant authorization. Browser E2E and real PostgreSQL integration tests are the next execution step once Playwright and Docker are available.

## Repository structure

- `apps/api`: Fastify API and repository adapters.
- `apps/web`: React/Vite application.
- `packages/contracts`: shared API/domain types.
- `infra/postgres`: versioned SQL migrations.
- `docker-compose.yml`: local PostgreSQL and Redis services.
- `.github/workflows/ci.yml`: pull request validation.
- `docs`: architecture decisions and operational runbooks.

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for status and [REPOSITORY_STRATEGY.md](./REPOSITORY_STRATEGY.md) for repository and commit planning.
