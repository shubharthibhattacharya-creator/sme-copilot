import { Module } from '@nestjs/common'
import { UploadTokensController } from './upload-tokens.controller'
import { UploadTokensService } from './upload-tokens.service'
import { StorageModule } from '../../common/storage/storage.module'
import { AiModule } from '../ai/ai.module'

@Module({
  imports: [StorageModule, AiModule],
  controllers: [UploadTokensController],
  providers: [UploadTokensService],
})
export class UploadTokensModule {}
