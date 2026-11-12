import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

type ProjectRow = { id: string; name: string; organization_id: string };

export default async function Page() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: projects } = user
    ? await supabase
        .from('projects')
        .select('id, name, organization_id')
        .order('created_at', { ascending: false })
    : { data: [] as ProjectRow[] };

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">ShipFlow</p>
        <h1>Open-source releases, safely promoted.</h1>
        <p className="lede">
          Track public GitHub projects and promote the same tested artifact from staging to
          production.
        </p>
      </header>
      {!user ? (
        <section className="card">
          <h2>Sign in to view projects</h2>
          <p>
            Supabase session integration is active. Authentication UI is the next ShipFlow
            milestone.
          </p>
        </section>
      ) : (
        <section className="card">
          <h2>Your projects</h2>
          {projects?.length ? (
            <ul className="project-list">
              {projects.map((project) => (
                <li key={project.id}>{project.name}</li>
              ))}
            </ul>
          ) : (
            <p>No projects yet.</p>
          )}
        </section>
      )}
    </main>
  );
}
