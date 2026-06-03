import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './prisma/prisma.module'
import { HealthController } from './health.controller'
import { AuthModule } from './modules/auth/auth.module'
import { CompaniesModule } from './modules/companies/companies.module'
import { UsersModule } from './modules/users/users.module'
import { InvoicesModule } from './modules/invoices/invoices.module'
import { InventoryModule } from './modules/inventory/inventory.module'
import { AiModule } from './modules/ai/ai.module'
import { DashboardModule } from './modules/dashboard/dashboard.module'
import { CollectionsModule } from './modules/collections/collections.module'
import { DocumentsModule } from './modules/documents/documents.module'
import { ReportsModule } from './modules/reports/reports.module'
import { StorageModule } from './common/storage/storage.module'
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module'
import { AiAssistantModule } from './modules/ai-assistant/ai-assistant.module'
import { OpscConfigModule } from './modules/config/config.module'
import { ClientsModule } from './modules/clients/clients.module'
import { SettingsModule } from './modules/settings/settings.module'
import { FilingsModule } from './modules/filings/filings.module'
import { UploadTokensModule } from './modules/upload-tokens/upload-tokens.module'
import { EmailModule } from './modules/email/email.module'
import { AdminModule } from './modules/admin/admin.module'
import { IntegrationsModule } from './modules/integrations/integrations.module'
import { EncryptionModule } from './common/encryption/encryption.module'
import { SchedulerModule } from './modules/scheduler/scheduler.module'
import { ComplianceModule } from './modules/compliance/compliance.module'
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module'
import { QueueModule } from './common/queue/queue.module'

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    EncryptionModule,
    QueueModule,
    EmailModule,
    OpscConfigModule,
    PrismaModule,
    StorageModule,
    AuthModule,
    CompaniesModule,
    UsersModule,
    InvoicesModule,
    InventoryModule,
    AiModule,
    DashboardModule,
    CollectionsModule,
    DocumentsModule,
    ReportsModule,
    WhatsAppModule,
    AiAssistantModule,
    ClientsModule,
    SettingsModule,
    FilingsModule,
    UploadTokensModule,
    AdminModule,
    IntegrationsModule,
    SchedulerModule,
    ComplianceModule,
    ReconciliationModule,
  ],
})
export class AppModule {}
