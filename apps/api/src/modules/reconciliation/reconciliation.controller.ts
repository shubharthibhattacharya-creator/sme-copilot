import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ReconciliationService } from './reconciliation.service'
import { UploadGstr2bDto } from './dto/upload-gstr2b.dto'
import { ResolveResultDto } from './dto/resolve-result.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequireModuleAccess } from '../../common/decorators/require-module.decorator'
import type { AuthenticatedUser } from '@opsc/types'

@Controller('reconciliation')
@RequireModuleAccess('documents')
export class ReconciliationController {
  constructor(private readonly reconService: ReconciliationService) {}

  // Upload GSTR-2B file and trigger reconciliation
  @Post('gstr2b')
  @UseInterceptors(FileInterceptor('file'))
  uploadGstr2b(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadGstr2bDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('No file attached')
    return this.reconService.uploadGstr2b(file, dto, user)
  }

  // List all GSTR-2B uploads for the company
  @Get('gstr2b')
  listUploads(@CurrentUser() user: AuthenticatedUser) {
    return this.reconService.listUploads(user.companyId)
  }

  // Get reconciliation results for a specific upload
  @Get('gstr2b/:id/results')
  getResults(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reconService.getResults(id, user.companyId)
  }

  // Accept / reject / manually link a reconciliation result
  @Patch('results/:id')
  resolveResult(
    @Param('id') id: string,
    @Body() dto: ResolveResultDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reconService.resolveResult(id, dto, user)
  }

  // List purchase invoices (for manual linking UI)
  @Get('purchase-invoices')
  listPurchaseInvoices(
    @CurrentUser() user: AuthenticatedUser,
    @Query('period') period?: string,
  ) {
    return this.reconService.listPurchaseInvoices(user.companyId, period)
  }
}
