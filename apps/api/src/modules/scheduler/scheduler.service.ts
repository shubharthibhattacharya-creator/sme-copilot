import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../../prisma/prisma.service'
import { FilingsService } from '../filings/filings.service'
import { EmailService } from '../email/email.service'
import { GstinService } from '../clients/gstin.service'

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly filings: FilingsService,
    private readonly email: EmailService,
    private readonly gstinSvc: GstinService,
  ) {}

  /**
   * Daily at 8 AM IST (02:30 UTC).
   * Sends deadline reminder emails to every company's admin users
   * when they have overdue or due-within-7-days GST filings.
   */
  @Cron('30 2 * * *')
  async sendDailyDeadlineReminders(): Promise<void> {
    this.logger.log('Running daily GST deadline reminder job')

    const companies = await this.prisma.company.findMany({
      select: { id: true },
    })

    let sent = 0
    let skipped = 0

    for (const company of companies) {
      try {
        const admins = await this.prisma.user.findMany({
          where: { companyId: company.id, role: 'ADMIN', isActive: true },
          select: { email: true, name: true },
        })

        if (admins.length === 0) { skipped++; continue }

        const rows = await this.filings.getCalendar(company.id)

        const overdue = rows
          .filter((r) => r.status === 'OVERDUE')
          .map((r) => ({ clientName: r.client.name, period: r.period, daysOverdue: r.daysRemaining }))

        const dueSoon = rows
          .filter((r) => r.status === 'PENDING' && r.daysRemaining <= 7)
          .map((r) => ({ clientName: r.client.name, period: r.period, daysRemaining: r.daysRemaining }))

        if (overdue.length === 0 && dueSoon.length === 0) { skipped++; continue }

        for (const admin of admins) {
          await this.email.sendDeadlineReminder({
            staffEmail: admin.email,
            staffName: admin.name,
            overdue,
            dueSoon,
          })
          sent++
        }
      } catch (err) {
        this.logger.error(`Reminder failed for company ${company.id}`, err)
      }
    }

    this.logger.log(`Deadline reminders complete — sent=${sent}, skipped=${skipped}`)
  }

  /**
   * Daily at 3 AM IST (21:30 UTC previous day).
   * Retries GSTIN verification for all clients in PENDING status.
   * Runs off-peak to avoid GSTN API load during filing season.
   */
  @Cron('30 21 * * *')
  async retryPendingGstinVerifications(): Promise<void> {
    this.logger.log('Running GSTIN verification retry job')
    try {
      const { retried, resolved } = await this.gstinSvc.retryPending()
      this.logger.log(`GSTIN retry complete — retried=${retried}, resolved=${resolved}`)
    } catch (err) {
      this.logger.error('GSTIN retry job failed', err)
    }
  }
}
