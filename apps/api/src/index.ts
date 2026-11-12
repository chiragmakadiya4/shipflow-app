import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { InMemoryRepository } from './repository.js';
import { PostgresRepository } from './postgres-repository.js';
import pg from 'pg';

const config = loadConfig();
const pool = config.DATABASE_URL
  ? new pg.Pool({ connectionString: config.DATABASE_URL })
  : undefined;
const app = createApp(pool ? new PostgresRepository(pool) : new InMemoryRepository());

await app.listen({ port: config.PORT, host: '0.0.0.0' });
