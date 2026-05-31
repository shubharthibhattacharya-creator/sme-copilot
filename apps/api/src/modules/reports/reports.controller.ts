import { Controller, Get, Post, Param, Body, Query, Res, BadRequestException } from '@nestjs/common'
import type { Response } from 'express'
import { ReportsService } from './reports.service'
import { ReportExportService } from './report-export.service'
import { CreateReportDto } from './dto/create-report.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { RequireModuleAccess } from '../../common/decorators/require-module.decorator'
import type { AuthenticatedUser } from '@opsc/types'

@Controller('reports')
@Roles('ADMIN', 'OPERATIONS_MANAGER')
@RequireModuleAccess('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly reportExportService: ReportExportService,
  ) {}

  @Post()
  create(@Body() dto: CreateReportDto, @CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.create(dto, user)
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.list(user.companyId)
  }

  @Get(':id/export')
  async export(
    @Param('id') id: string,
    @Query('format') format: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const fmt = (format ?? 'pdf').toLowerCase()
    if (!['pdf', 'excel', 'word'].includes(fmt)) {
      throw new BadRequestException('format must be pdf, excel, or word')
    }

    let buffer: Buffer
    let contentType: string
    let ext: string

    if (fmt === 'pdf') {
      buffer = await this.reportExportService.exportPdf(id, user.companyId)
      contentType = 'application/pdf'
      ext = 'pdf'
    } else if (fmt === 'excel') {
      buffer = await this.reportExportService.exportExcel(id, user.companyId)
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ext = 'xlsx'
    } else {
      buffer = await this.reportExportService.exportWord(id, user.companyId)
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ext = 'docx'
    }

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `attachment; filename="report-${id}.${ext}"`)
    res.setHeader('Content-Length', buffer.length)
    res.end(buffer)
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.findOne(id, user.companyId)
  }
}
