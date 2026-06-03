import 'reflect-metadata'
import * as Sentry from '@sentry/nestjs'

Sentry.init({
  dsn: process.env['SENTRY_DSN'],
  environment: process.env['NODE_ENV'] ?? 'development',
  tracesSampleRate: 0.1,
  enabled: !!process.env['SENTRY_DSN'],
})

import { NestFactory } from '@nestjs/core'
import { ValidationPipe, Logger } from '@nestjs/common'
import { getQueueToken } from '@nestjs/bullmq'
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { ExpressAdapter as BullBoardExpressAdapter } from '@bull-board/express'
import type { Queue } from 'bullmq'
import type { Request, Response, NextFunction } from 'express'
import { AppModule } from './app.module'
import { GlobalExceptionFilter } from './common/filters/global-exception.filter'
import { validateEnv } from '@opsc/config'
import { QUEUE_OCR, QUEUE_REPORTS, QUEUE_INSIGHTS } from './common/queue/queue.constants'

async function bootstrap() {
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

  app.useGlobalFilters(new GlobalExceptionFilter())

  // /health is outside the api/v1 prefix so Railway healthchecks work
  app.setGlobalPrefix('api/v1', { exclude: ['health'] })

  // ── Bull Board — job queue monitor at /admin/queues ───────────────────────
  const boardAdapter = new BullBoardExpressAdapter()
  boardAdapter.setBasePath('/admin/queues')

  createBullBoard({
    queues: [
      new BullMQAdapter(app.get<Queue>(getQueueToken(QUEUE_OCR))),
      new BullMQAdapter(app.get<Queue>(getQueueToken(QUEUE_REPORTS))),
      new BullMQAdapter(app.get<Queue>(getQueueToken(QUEUE_INSIGHTS))),
    ],
    serverAdapter: boardAdapter,
  })

  // Basic-auth guard: username = admin, password = ADMIN_SECRET
  const adminSecret = process.env['ADMIN_SECRET'] ?? ''
  app.use('/admin/queues', (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization']
    if (authHeader?.startsWith('Basic ')) {
      const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8')
      const password = decoded.split(':').slice(1).join(':') // handle colons in password
      if (password === adminSecret) return next()
    }
    res.set('WWW-Authenticate', 'Basic realm="Bull Board"')
    res.status(401).send('Unauthorized')
  })

  app.use('/admin/queues', boardAdapter.getRouter())
  Logger.log('Bull Board available at /admin/queues', 'Bootstrap')
  // ─────────────────────────────────────────────────────────────────────────

  // Railway injects PORT; fall back to API_PORT for local dev
  const port = parseInt(process.env['PORT'] ?? String(env.API_PORT), 10)

  await app.listen(port, '0.0.0.0')
  Logger.log(`OpsCopilot API running on port ${port}`, 'Bootstrap')
}

bootstrap()
