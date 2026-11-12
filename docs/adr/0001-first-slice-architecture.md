# ADR 0001: First-slice architecture

Status: Accepted

## Decision

Use a pnpm TypeScript monorepo containing a React/Vite web app, a Fastify API, a shared contracts package, PostgreSQL, and Redis. Keep the API as a modular monolith and isolate persistence behind a repository interface.

## Reasons

- Frontend and backend can evolve together while sharing stable contract types.
- PostgreSQL remains the transactional source of truth.
- A repository boundary allows deterministic unit/API tests and a real PostgreSQL adapter.
- Redis can be introduced for cache/session/rate-limit behavior without coupling business logic to it.
- RabbitMQ, Kafka, and Spark are deferred until the product has real asynchronous/event analytics requirements.

## Consequences

The current demo auth uses an `x-user-id` header. Before any public deployment, it must be replaced by a real OIDC/session flow, with backend authorization retained as the source of truth.
