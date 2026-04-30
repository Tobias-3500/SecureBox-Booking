const { z } = require('zod');
const logger = require('./logger');

require('dotenv').config();

const portSchema = z.coerce.number().int().min(1).max(65535);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  DB_HOST: z.string().min(1, 'DB_HOST is required'),
  DB_PORT: portSchema,
  DB_USER: z.string().min(1, 'DB_USER is required'),
  DB_PASSWORD: z.string().min(1, 'DB_PASSWORD is required'),
  DB_NAME: z.string().min(1, 'DB_NAME is required'),
  BACKEND_PORT: portSchema,
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  CORS_ORIGIN: z.string().min(1, 'CORS_ORIGIN is required'),
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
  ADMIN_EMAIL: z.string().email('ADMIN_EMAIL must be a valid email address'),
  RESEND_FROM: z.string().min(1, 'RESEND_FROM is required'),
  BACKUP_VM_HOST: z.string().min(1).default('10.0.0.1'),
  BACKUP_SCRIPT_PATH: z.string().min(1).default('/root/backup.sh'),
  BACKUP_LOG_PATH: z.string().min(1).default('/var/log/backup.log'),
});

const shouldSkipValidation = process.env.NODE_ENV === 'test' || process.env.SKIP_ENV_VALIDATION === 'true';

const parsedEnv = envSchema.safeParse(process.env);

if (shouldSkipValidation) {
  logger.warn('[env] Skipping strict environment validation (test/CI mode).');
}

if (!shouldSkipValidation && !parsedEnv.success) {
  logger.error('Invalid environment configuration', {
    errors: parsedEnv.error.format(),
  });
  process.exit(1);
}

/**
 * @typedef {z.infer<typeof envSchema>} Env
 */

/** @type {Env} */
const env = shouldSkipValidation ? process.env : parsedEnv.data;

module.exports = { env };
