import { Global, Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { QUEUE_OCR, QUEUE_REPORTS, QUEUE_INSIGHTS } from './queue.constants'

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
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
