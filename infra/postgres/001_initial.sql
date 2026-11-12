CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_memberships (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, organization_id)
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memberships_user_id_idx ON organization_memberships (user_id);
CREATE INDEX IF NOT EXISTS projects_organization_id_idx ON projects (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS repositories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('github')),
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  default_branch TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, provider, owner, name)
);

CREATE TABLE IF NOT EXISTS deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  environment TEXT NOT NULL CHECK (environment IN ('staging', 'production')),
  commit_sha TEXT NOT NULL CHECK (commit_sha ~ '^[0-9a-f]{7,64}$'),
  artifact_digest TEXT NOT NULL CHECK (artifact_digest ~ '^sha256:[0-9a-f]{64}$'),
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'rolled_back')),
  promoted_from_deployment_id UUID REFERENCES deployments(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deployments_project_id_idx ON deployments (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO users (id, email) VALUES
  ('demo-user', 'demo@example.com'),
  ('other-user', 'other@example.com')
ON CONFLICT (id) DO NOTHING;
