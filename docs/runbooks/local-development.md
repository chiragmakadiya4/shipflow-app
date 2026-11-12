# Local development runbook

## Start dependencies

Run `docker compose up -d` and wait for the PostgreSQL and Redis health checks to pass.

## Apply database changes

Set `DATABASE_URL` and run `pnpm db:migrate`. Migrations are append-only and must be reviewed before applying to staging or production.

## Run and verify

Use separate terminals for the API and web app. Run `pnpm check` before opening a pull request. If Docker is unavailable, use the API's in-memory repository for API tests and record the missing integration verification.

## Rollback

Application rollback is performed by promoting the previous immutable image digest. Database changes must follow expand/contract rules so the previous application version remains compatible during rollback.
