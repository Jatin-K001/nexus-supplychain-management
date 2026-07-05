import { Pool } from 'pg';
import { env } from './env';

export const pool = new Pool({
  host: env.dbHost,
  port: env.dbPort,
  user: env.dbUser,
  password: env.dbPassword,
  database: env.dbName,
  ssl: { rejectUnauthorized: false },
  max: 10,
});
