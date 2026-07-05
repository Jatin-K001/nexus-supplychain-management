import path from 'path';
import dotenv from 'dotenv';

// nexus/.env is the single source of truth for every app in the monorepo
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const env = {
  dbHost: process.env.DB_HOST!,
  dbPort: Number(process.env.DB_PORT || 5432),
  dbUser: process.env.DB_USER!,
  dbPassword: process.env.DB_PASSWORD!,
  dbName: process.env.DB_NAME || 'postgres',
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  port: Number(process.env.PORT || 4000),
};
