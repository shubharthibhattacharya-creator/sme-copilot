// Typed environment variable access.
// Call `validateEnv()` at app startup to fail fast on missing vars.

export interface AppEnv {
  NODE_ENV: 'development' | 'test' | 'production'
  DATABASE_URL: string
  REDIS_URL?: string
  CLERK_SECRET_KEY: string
  CLERK_WEBHOOK_SECRET: string
  ANTHROPIC_API_KEY: string
  ANTHROPIC_MODEL: string
  API_PORT: number
  API_URL: string
  TWILIO_ACCOUNT_SID?: string
  TWILIO_AUTH_TOKEN?: string
  TWILIO_WHATSAPP_FROM?: string
  S3_BUCKET?: string
  S3_REGION?: string
  S3_ACCESS_KEY_ID?: string
  S3_SECRET_ACCESS_KEY?: string
  S3_ENDPOINT?: string
}

const required: Array<keyof AppEnv> = [
  'DATABASE_URL',
  'CLERK_SECRET_KEY',
  'CLERK_WEBHOOK_SECRET',
  'ANTHROPIC_API_KEY',
]

export function validateEnv(): AppEnv {
  const missing = required.filter((key) => !process.env[key])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  return {
    NODE_ENV: (process.env['NODE_ENV'] as AppEnv['NODE_ENV']) ?? 'development',
    DATABASE_URL: process.env['DATABASE_URL']!,
    ...(process.env['REDIS_URL'] !== undefined ? { REDIS_URL: process.env['REDIS_URL'] } : {}),
    CLERK_SECRET_KEY: process.env['CLERK_SECRET_KEY']!,
    CLERK_WEBHOOK_SECRET: process.env['CLERK_WEBHOOK_SECRET']!,
    ANTHROPIC_API_KEY: process.env['ANTHROPIC_API_KEY']!,
    ANTHROPIC_MODEL: process.env['ANTHROPIC_MODEL'] ?? 'claude-sonnet-4-6',
    API_PORT: parseInt(process.env['API_PORT'] ?? '3001', 10),
    API_URL: process.env['API_URL'] ?? 'http://localhost:3001',
    ...(process.env['TWILIO_ACCOUNT_SID'] !== undefined ? { TWILIO_ACCOUNT_SID: process.env['TWILIO_ACCOUNT_SID'] } : {}),
    ...(process.env['TWILIO_AUTH_TOKEN'] !== undefined ? { TWILIO_AUTH_TOKEN: process.env['TWILIO_AUTH_TOKEN'] } : {}),
    ...(process.env['TWILIO_WHATSAPP_FROM'] !== undefined ? { TWILIO_WHATSAPP_FROM: process.env['TWILIO_WHATSAPP_FROM'] } : {}),
    ...(process.env['S3_BUCKET'] !== undefined ? { S3_BUCKET: process.env['S3_BUCKET'] } : {}),
    ...(process.env['S3_REGION'] !== undefined ? { S3_REGION: process.env['S3_REGION'] } : {}),
    ...(process.env['S3_ACCESS_KEY_ID'] !== undefined ? { S3_ACCESS_KEY_ID: process.env['S3_ACCESS_KEY_ID'] } : {}),
    ...(process.env['S3_SECRET_ACCESS_KEY'] !== undefined ? { S3_SECRET_ACCESS_KEY: process.env['S3_SECRET_ACCESS_KEY'] } : {}),
    ...(process.env['S3_ENDPOINT'] !== undefined ? { S3_ENDPOINT: process.env['S3_ENDPOINT'] } : {}),
  }
}
