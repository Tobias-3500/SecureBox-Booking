/*
 * env.js — Validering af miljøvariabler (konfiguration).
 *
 * HVAD FILEN GØR:
 * Læser alle nødvendige indstillinger (databaseadgang, JWT-hemmelighed, API-nøgler m.m.)
 * fra miljøet og validerer dem med Zod, FØR resten af systemet starter.
 * Mangler eller er en variabel forkert, stopper serveren med en tydelig fejl ved opstart
 * i stedet for at fejle uforudsigeligt senere.
 *
 * HVORFOR: Hemmeligheder (adgangskoder, nøgler) ligger aldrig i koden. De kommer fra
 * miljøet/.env-filen, så koden trygt kan deles offentligt på GitHub.
 */

const { z } = require('zod');          // Skema-validering
const crypto = require('crypto');      // Bruges til at tjekke at Googles private nøgle er gyldig
const logger = require('./logger');

require('dotenv').config();            // Indlæser variabler fra .env-filen til process.env

// Genbrugelige byggeklodser til validering.
const portSchema = z.coerce.number().int().min(1).max(65535);     // Et gyldigt portnummer
const booleanStringSchema = z.enum(['true', 'false']).default('false');
const emailSchema = z.string().email();

// Skemaet beskriver præcis hvilke variabler systemet kræver, og hvilken form de skal have.
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
  BACKUP_LOG_PATH: z.string().min(1).default('/var/log/backup.log'),
  GOOGLE_CALENDAR_ENABLED: booleanStringSchema,
  GOOGLE_CALENDAR_ID: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().optional(),
  GOOGLE_CALENDAR_TIMEZONE: z.string().min(1).default('Europe/Copenhagen'),
}).superRefine((value, ctx) => {
  // Ekstra validering: KUN hvis Google Kalender er slået til, kræves Google-variablerne.
  // Er integrationen slået fra, springes alle disse tjek over.
  if (value.GOOGLE_CALENDAR_ENABLED !== 'true') {
    return;
  }

  if (!value.GOOGLE_CALENDAR_ID) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['GOOGLE_CALENDAR_ID'],
      message: 'GOOGLE_CALENDAR_ID is required when GOOGLE_CALENDAR_ENABLED=true',
    });
  }

  if (!value.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['GOOGLE_SERVICE_ACCOUNT_EMAIL'],
      message: 'GOOGLE_SERVICE_ACCOUNT_EMAIL is required when GOOGLE_CALENDAR_ENABLED=true',
    });
  } else if (!emailSchema.safeParse(value.GOOGLE_SERVICE_ACCOUNT_EMAIL).success) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['GOOGLE_SERVICE_ACCOUNT_EMAIL'],
      message: 'GOOGLE_SERVICE_ACCOUNT_EMAIL must be a valid email address when GOOGLE_CALENDAR_ENABLED=true',
    });
  }

  if (!value.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'],
      message: 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY is required when GOOGLE_CALENDAR_ENABLED=true',
    });
  } else {
    try {
      crypto.createPrivateKey(value.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'));
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'],
        message: 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY must be a valid private key when GOOGLE_CALENDAR_ENABLED=true',
      });
    }
  }
});

// I test/CI-miljøer (fx GitHub Actions, der bare bygger images) springes den strenge
// validering over, da de rigtige hemmeligheder ikke er til stede der.
const shouldSkipValidation = process.env.NODE_ENV === 'test' || process.env.SKIP_ENV_VALIDATION === 'true';

// Kører selve valideringen mod alle miljøvariabler.
const parsedEnv = envSchema.safeParse(process.env);

if (shouldSkipValidation) {
  logger.warn('[env] Skipping strict environment validation (test/CI mode).');
}

// Er konfigurationen ugyldig, stoppes serveren med det samme (process.exit(1)),
// så systemet aldrig starter i en halvfærdig/usikker tilstand.
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
// Resten af systemet importerer 'env' herfra — aldrig direkte fra process.env.
const env = shouldSkipValidation ? process.env : parsedEnv.data;

module.exports = { env };
