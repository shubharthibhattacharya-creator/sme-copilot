import { Global, Module, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import * as Sentry from '@sentry/nestjs'
import { QueueEvents } from 'bullmq'
import { QUEUE_OCR, QUEUE_REPORTS, QUEUE_INSIGHTS, QUEUE_RECON } from './queue.constants'

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          url: process.env['REDIS_URL'],
          // Upstash requires TLS — ioredis handles rediss:// automatically
          tls: process.env['REDIS_URL']?.startsWith('rediss://') ? {} : undefined,
          maxRetriesPerRequest: null, // required by BullMQ
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 100 },
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_OCR },
      { name: QUEUE_REPORTS },
      { name: QUEUE_INSIGHTS },
      { name: QUEUE_RECON },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueModule.name)
  private readonly queueEvents: QueueEvents[] = []

  onModuleInit() {
    const redisUrl = process.env['REDIS_URL']
    if (!redisUrl) return

    const connection = {
      url: redisUrl,
      tls: redisUrl.startsWith('rediss://') ? {} : undefined,
      maxRetriesPerRequest: null as unknown as number,
    }

    for (const name of [QUEUE_OCR, QUEUE_REPORTS, QUEUE_INSIGHTS, QUEUE_RECON]) {
      const qe = new QueueEvents(name, { connection })
      qe.on('failed', ({ jobId, failedReason }) => {
        this.logger.error(`Job ${jobId} in queue "${name}" failed: ${failedReason}`)
        Sentry.captureException(new Error(failedReason), {
          extra: { queue: name, jobId },
        })
      })
      this.queueEvents.push(qe)
    }
  }

  async onModuleDestroy() {
    await Promise.all(this.queueEvents.map((qe) => qe.close()))
  }
}
