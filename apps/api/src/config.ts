import { Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

const environmentSchema = Type.Object({
  PORT: Type.Optional(Type.String()),
  DATABASE_URL: Type.Optional(Type.String()),
  REDIS_URL: Type.Optional(Type.String()),
});

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const input = {
    PORT: env.PORT,
    DATABASE_URL: env.DATABASE_URL,
    REDIS_URL: env.REDIS_URL,
  };
  if (!Value.Check(environmentSchema, input)) throw new Error('Invalid environment configuration');
  const port = Number(input.PORT ?? 4000);
  if (!Number.isInteger(port) || port <= 0) throw new Error('Invalid PORT configuration');
  return {
    PORT: port,
    DATABASE_URL: input.DATABASE_URL,
    REDIS_URL: input.REDIS_URL ?? 'redis://localhost:6379',
  };
}
