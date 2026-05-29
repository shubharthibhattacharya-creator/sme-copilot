import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe, Logger } from '@nestjs/common'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'
import { validateEnv } from '@opsc/config'

async function bootstrap() {
  // Diagnostic: log which env var keys Railway injects (no values, just keys)
  console.log('[DIAG] process.env keys:', Object.keys(process.env).sort().join(', '))

  const env = validateEnv()

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  })

  // Collect all allowed origins from env — supports multiple comma-separated URLs
  const rawOrigins = [
    process.env['NEXT_PUBLIC_APP_URL'],
    process.env['ALLOWED_ORIGINS'],           // e.g. "https://opsc.up.railway.app,https://yourdomain.com"
    'http://localhost:3000',
    'http://localhost:3002',
    'http://localhost:3100',
  ]
  const allowedOrigins = rawOrigins
    .flatMap((o) => (o ? o.split(',').map((s) => s.trim()) : []))
    .filter(Boolean)

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, server-to-server, same-origin)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`))
      }
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-secret'],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  app.useGlobalFilters(new HttpExceptionFilter())

  // /health is outside the api/v1 prefix so Railway healthchecks work
  app.setGlobalPrefix('api/v1', { exclude: ['health'] })

  // Railway injects PORT; fall back to API_PORT for local dev
  const port = parseInt(process.env['PORT'] ?? String(env.API_PORT), 10)

  await app.listen(port, '0.0.0.0')
  Logger.log(`OpsCopilot API running on port ${port}`, 'Bootstrap')
}

bootstrap()
