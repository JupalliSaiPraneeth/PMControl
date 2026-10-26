import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DASHBOARD_ORIGIN: z.string().default('http://localhost:5173'),
  SUPABASE_URL: z.string().url().default('https://example.supabase.co'),
  SUPABASE_ANON_KEY: z.string().default('dummy-anon-key-for-tests'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default('dummy-service-role-key-for-tests'),
  STUN_SERVER_URL: z.string().default('stun:stun.l.google.com:19302'),
  TURN_SERVER_URL: z.string().optional(),
  TURN_USERNAME: z.string().optional(),
  TURN_CREDENTIAL: z.string().optional(),
  PAIRING_CODE_TTL_SECONDS: z.coerce.number().default(300),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_ATTEMPTS: z.coerce.number().default(10),
});

export const config = envSchema.parse(process.env);
