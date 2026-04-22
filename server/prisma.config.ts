import path from 'path';
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Load .env from parent directory (root level)
// Production: C:\deploy-server\wow-gift\.env
// Development: project_root\.env or server\.env (fallback)
const rootEnvPath = path.join(__dirname, '..', '.env');
const serverEnvPath = path.join(__dirname, '.env');

// Try root first, then server directory as fallback (for development)
config({ path: rootEnvPath });
if (!process.env.DATABASE_URL) {
  config({ path: serverEnvPath });
}

export default defineConfig({
  schema: path.join(__dirname, 'prisma/schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL!,
  },
  migrations: {
    seed: 'npx tsx prisma/seed.ts',
  },
});
