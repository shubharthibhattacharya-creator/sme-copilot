import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
  UseInterceptors, UploadedFile, HttpCode, HttpStatus,
  StreamableFile, NotFoundException, BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { DocumentsService } from './documents.service'
import { StorageService } from '../../common/storage/storage.service'
import { UploadDocumentDto } from './dto/upload-document.dto'
import { ListDocumentsDto } from './dto/list-documents.dto'
import { CreateDocumentRequestDto } from './dto/create-document-request.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import type { AuthenticatedUser } from '@opsc/types'

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly storageService: StorageService,
  ) {}

  @Post()
  @Roles('ADMIN', 'OPERATIONS_MANAGER')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('No file attached')
    return this.documentsService.upload(file, dto, user)
  }

  @Get()
  list(@Query() dto: ListDocumentsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.list(user.companyId, dto)
  }

  @Get('requests')
  listRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.listRequests(user.companyId)
  }

  @Post('requests')
  createRequest(
    @Body() dto: CreateDocumentRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.createRequest(dto, user)
  }

  @Get('file/:key(*)')
  async serveFile(
    @Param('key') key: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Ensure the key belongs to the authenticated company (tenant isolation)
    if (!key.startsWith(user.companyId + '/')) {
      throw new NotFoundException('File not found')
    }
    const buffer = await this.storageService.readFile(key)
    return new StreamableFile(buffer)
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.findOne(id, user.companyId)
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.delete(id, user.companyId)
  }

  @Post(':id/reprocess')
  @Roles('ADMIN', 'OPERATIONS_MANAGER')
  reprocess(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.reprocess(id, user.companyId)
  }

  @Post(':id/verify')
  @Roles('ADMIN', 'OPERATIONS_MANAGER')
  verify(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.verifyDocument(id, user.companyId)
  }

  @Patch(':id/resolve-classification')
  @Roles('ADMIN', 'OPERATIONS_MANAGER')
  resolveClassification(
    @Param('id') id: string,
    @Body('documentOwner') documentOwner: 'FIRM' | 'CLIENT',
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.resolveClassification(id, user.companyId, documentOwner)
  }

  @Patch(':id/extracted-data')
  @Roles('ADMIN', 'OPERATIONS_MANAGER')
  updateExtractedData(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.updateExtractedData(id, user.companyId, body)
  }

  @Patch(':id/filing-period')
  @Roles('ADMIN', 'OPERATIONS_MANAGER')
  updateFilingPeriod(
    @Param('id') id: string,
    @Body('filingPeriod') filingPeriod: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.updateFilingPeriod(id, user.companyId, filingPeriod)
  }

  @Post('requests/:requestId/fulfill')
  @Roles('ADMIN', 'OPERATIONS_MANAGER')
  fulfillRequest(
    @Param('requestId') requestId: string,
    @Body('documentId') documentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.fulfillRequest(requestId, documentId, user.companyId)
  }
}
