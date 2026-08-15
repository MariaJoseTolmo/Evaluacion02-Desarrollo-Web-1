import { config as loadEnv } from 'dotenv';

// Loaded here rather than in main.ts: CommonJS hoists every `require` above
// ordinary statements, so any module reading process.env at import time would
// otherwise see an empty environment.
loadEnv();

/**
 * Single source of configuration for the API.
 * Every environment-driven value lives here — no factories, no per-module config.
 */
const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export const config = {
  port: Number(process.env.PORT ?? 3000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: required('DB_USERNAME'),
    password: required('DB_PASSWORD'),
    database: required('DB_DATABASE'),
    // Auto-sync keeps the schema in step with the entities for this coursework.
    // A production deployment would run TypeORM migrations instead.
    synchronize: process.env.DB_SYNCHRONIZE !== 'false',
  },
  jwt: {
    secret: required('JWT_SECRET'),
    // `ms`-style duration string, e.g. '1d', '12h', '30m'.
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '1d') as `${number}${'s' | 'm' | 'h' | 'd'}`,
  },
  /**
   * Argon2id parameters. Defaults follow the OWASP Password Storage baseline:
   * 19 MiB of memory, 2 iterations, 1 lane. Memory cost is what makes the
   * algorithm resistant to GPU and ASIC cracking, so it is the knob to raise
   * first as hardware improves.
   */
  argon2: {
    memoryCost: Number(process.env.ARGON2_MEMORY_COST ?? 19456), // KiB
    timeCost: Number(process.env.ARGON2_TIME_COST ?? 2),
    parallelism: Number(process.env.ARGON2_PARALLELISM ?? 1),
  },
};
