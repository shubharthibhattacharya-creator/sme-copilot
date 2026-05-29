import {
  Controller, Get, Post, Param, Body, HttpCode, HttpStatus,
  UseInterceptors, UploadedFile,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'
import { UploadTokensService } from './upload-tokens.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Public } from '../../common/decorators/public.decorator'
import type { AuthenticatedUser } from '@opsc/types'

class CreateTokenDto {
  @IsOptional()
  @IsString()
  clientId?: string

  @IsOptional()
  @IsString()
  label?: string

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(720)
  @Type(() => Number)
  expiryHours?: number
}

@Controller()
export class UploadTokensController {
  constructor(private readonly service: UploadTokensService) {}

  // ── Authenticated endpoints ──────────────────────────────────────────────────

  @Post('upload-tokens')
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTokenDto) {
    return this.service.createToken(user.companyId, dto.clientId, dto.label, dto.expiryHours)
  }

  @Get('upload-tokens')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listTokens(user.companyId)
  }

  // ── Public endpoints (no auth) ───────────────────────────────────────────────

  @Public()
  @Get('public/upload/:token')
  resolveToken(@Param('token') token: string) {
    return this.service.resolveToken(token)
  }

  @Public()
  @Post('public/upload/:token')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  uploadWithToken(
    @Param('token') token: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('documentType') documentType: string,
    @Body('filingPeriod') filingPeriod: string,
    @Body('notes') notes: string,
  ) {
    return this.service.uploadWithToken(token, file, documentType, filingPeriod, notes)
  }
}
