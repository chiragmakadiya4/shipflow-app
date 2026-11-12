# ShipFlow Repository and Commit Strategy

## Recommended repositories

### 1. `shipflow-app`

This is the main product repository:

```text
apps/web/                 Next.js App Router application for Vercel
apps/api/                 Fastify API/BFF while the backend remains separate
apps/worker/              optional async worker when RabbitMQ work begins
packages/contracts/       shared request/response/domain types
packages/config/          shared TypeScript/tooling configuration
infra/migrations/         PostgreSQL migrations owned by the app
tests/                    integration and Playwright E2E tests
docs/                      ADRs, runbooks, threat model, demo instructions
```

The web app, contracts, domain logic, migrations, and tests stay together because they must change atomically and are useful to reviewers in one GitHub repository.

### 2. `shipflow-infra`

Create this when hosted infrastructure becomes real:

```text
terraform/modules/        reusable infrastructure modules
terraform/environments/   dev, staging, production stacks
vercel/                   project settings and deployment documentation
github/                   repository environments, OIDC, webhook setup
policies/                 IAM/security policies and budget alerts
runbooks/                 infrastructure rollback and recovery procedures
```

Keep secrets and Terraform state in the hosting platforms. Commit only templates, variable examples, policies, and reviewed infrastructure code.

### 3. `shipflow-workers` — later, only if justified

Create this when workers have independent deployment/scaling needs:

```text
workers/github-sync/      bounded repository synchronization
workers/deployment/       RabbitMQ deployment execution
streaming/kafka/          event consumers and producers
analytics/spark/          batch/stream analytics jobs
```

Do not create this repository at the start. A separate worker repository is justified when it has a separate release cadence, runtime, ownership boundary, or resource profile. For a personal demo, GitHub Actions/Vercel Cron plus a small Next.js server-side job is enough for low-volume sync.

## Commit strategy

Use conventional commits and small, reviewable commits:

```text
feat(contract): add tracked repository and release types
feat(api): add repository registration endpoint
feat(sync): add bounded GitHub public repository sync
test(api): cover tenant isolation and sync idempotency
feat(web): add release radar dashboard
ci: add Vercel preview and production checks
docs: add architecture and deployment runbook
```

Every commit should pass formatting, lint, typecheck, and relevant tests. Do not commit generated `dist/`, `.env`, credentials, database dumps, or hosted-provider state.

## Branch and release strategy

- `main`: always deployable; protected branch.
- Feature branches: one focused change, opened as a pull request.
- Vercel preview deployment: every pull request.
- `staging` environment: deployment of the selected commit after CI passes.
- Production: promote the same tested Vercel deployment/artifact, with a release tag such as `v0.1.0`.
- Rollback: redeploy the previous Vercel deployment and revert the database only through a reviewed migration strategy.

## Initial commit sequence

- [x] `chore(repo): initialize shipflow-app workspace` — `7cf71e3`
- [x] `chore(tooling): configure Auth0 MCP for workspace` — `63f824b`
- [x] `feat(contract): add open-source repository tracking contracts` — included in the initial workspace commit
- [x] `feat(api): add repository and deployment lifecycle endpoints` — included in the initial workspace commit
- [x] `test(api): cover promotion, idempotency, and tenant isolation` — included in the initial workspace commit
- [x] `feat(web): migrate dashboard to Next.js App Router` — included in the initial workspace commit
- [ ] `feat(sync): track selected public GitHub repositories`
- [ ] `ci: add checks and Vercel preview deployment documentation`
- [ ] `docs: add free-tier limits and demo runbook`
- [ ] Tag first demo release as `v0.1.0` after the hosted demo is verified

## Local repository status

- `shipflow-app`: initialized at the workspace root. It contains the Next.js web app, Fastify API, shared contracts, migrations, tests, and product documentation.
- `shipflow-infra`: initialized as a sibling directory with Terraform, Vercel, and GitHub configuration boundaries. It currently contains documentation only because hosted resources have not been provisioned.
- `shipflow-workers`: intentionally not created yet. Create it when RabbitMQ/Kafka/Spark workers have an independent runtime, release cadence, or scaling requirement.

Remote GitHub repositories still need to be created or connected by the owner. No credentials or remote URLs are stored in the workspace.

## Commit plan from this point

1. Keep `main` deployable and use one focused conventional commit per feature.
2. Run `pnpm check` and `pnpm build` before each application commit.
3. Commit shared contract changes before the API or web consumer that uses them.
4. Use pull requests for feature branches and deploy the selected merge commit to staging.
5. Promote the exact tested staging commit/artifact to production after smoke tests and approval.
6. Tag the first verified public demo as `v0.1.0`.
