import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  HttpCode, HttpStatus, Res, UploadedFile, UseInterceptors, BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Response } from 'express'
import * as ExcelJS from 'exceljs'
import { SettingsService } from './settings.service'
import { UpdateFirmProfileDto } from './dto/update-firm-profile.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { RequireModuleAccess } from '../../common/decorators/require-module.decorator'
import type { AuthenticatedUser } from '@opsc/types'
import { ConfigService } from '../config/config.service'
import { ConfigKey } from '../config/config-key.enum'

const RISK_WEIGHT_KEYS = [ConfigKey.RISK_WEIGHT_AGING, ConfigKey.RISK_WEIGHT_AMOUNT, ConfigKey.RISK_WEIGHT_HISTORY]

@Controller('settings')
@RequireModuleAccess('settings')
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly configService: ConfigService,
  ) {}

  @Get('profile')
  @Roles('ADMIN', 'OPERATIONS_MANAGER', 'STAFF')
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.settings.getFirmProfile(user.companyId)
  }

  @Post('complete-onboarding')
  @HttpCode(HttpStatus.OK)
  completeOnboarding(@CurrentUser() user: AuthenticatedUser) {
    return this.settings.completeOnboarding(user.companyId)
  }

  @Patch('profile')
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateFirmProfileDto) {
    return this.settings.updateFirmProfile(user.companyId, dto)
  }

  // ── Legacy config endpoints (keep for backwards compatibility) ────────────────

  @Get('config')
  getConfig(@CurrentUser() user: AuthenticatedUser) {
    return this.settings.getConfig(user.companyId)
  }

  @Patch('config/:key')
  setConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Body('value') value: unknown,
  ) {
    return this.settings.setConfig(user.companyId, key, value, user.userId)
  }

  @Delete('config/:key')
  @HttpCode(HttpStatus.OK)
  resetConfig(@CurrentUser() user: AuthenticatedUser, @Param('key') key: string) {
    return this.settings.resetConfig(user.companyId, key)
  }

  // ── Business Rules endpoints ──────────────────────────────────────────────────

  @Get('rules')
  @Roles('ADMIN', 'OPERATIONS_MANAGER')
  getRules(@CurrentUser() user: AuthenticatedUser) {
    return this.configService.getAll(user.companyId, true)
  }

  @Get('rules/validate-weights')
  async validateWeights(@CurrentUser() user: AuthenticatedUser) {
    const [aging, amount, history] = await Promise.all([
      this.configService.getNum(user.companyId, ConfigKey.RISK_WEIGHT_AGING),
      this.configService.getNum(user.companyId, ConfigKey.RISK_WEIGHT_AMOUNT),
      this.configService.getNum(user.companyId, ConfigKey.RISK_WEIGHT_HISTORY),
    ])
    const result = this.configService.validateWeightSum(aging, amount, history)
    return {
      valid: result.valid,
      sum: result.sum,
      message: result.valid
        ? 'Risk weights sum to 1.0 ✓'
        : `Risk weights must sum to 1.0. Currently: ${result.sum}`,
    }
  }

  @Get('rules/export')
  async exportRules(@CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    const snapshot = await this.configService.getAll(user.companyId, true)
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Business Rules')

    // Header row
    ws.columns = [
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Key', key: 'key', width: 40 },
      { header: 'Label', key: 'label', width: 38 },
      { header: 'Current Value', key: 'current', width: 20 },
      { header: 'System Default', key: 'default', width: 18 },
      { header: 'Type', key: 'type', width: 10 },
      { header: 'Min', key: 'min', width: 8 },
      { header: 'Max', key: 'max', width: 8 },
      { header: 'Unit', key: 'unit', width: 14 },
      { header: 'Is Overridden', key: 'overridden', width: 14 },
      { header: 'Description', key: 'description', width: 60 },
    ]
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } }
    ws.getRow(1).height = 18

    const entries = Object.entries(snapshot).sort(([, a], [, b]) =>
      a.category.localeCompare(b.category) || (a.label ?? '').localeCompare(b.label ?? ''),
    )

    entries.forEach(([key, entry], i) => {
      const row = ws.addRow({
        category: entry.category,
        key,
        label: entry.label,
        current: String(entry.value ?? ''),
        default: String(entry.defaultValue ?? entry.systemDefault ?? ''),
        type: entry.dataType,
        min: entry.minValue != null ? String(entry.minValue) : '',
        max: entry.maxValue != null ? String(entry.maxValue) : '',
        unit: entry.unit ?? '',
        overridden: entry.isOverridden ? 'Yes' : 'No',
        description: entry.description ?? '',
      })
      if (i % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
      }
      if (entry.isOverridden) {
        row.getCell('current').font = { bold: true, color: { argb: 'FFD97706' } }
      }
    })

    // Instructions sheet
    const ws2 = wb.addWorksheet('Instructions')
    ws2.getCell('A1').value = 'How to use this file'
    ws2.getCell('A1').font = { bold: true, size: 14 }
    ws2.getCell('A2').value = '1. Edit the "Current Value" column (column D) in the Business Rules sheet.'
    ws2.getCell('A3').value = '2. Do not change the Key column (column B) — it is used to identify each rule.'
    ws2.getCell('A4').value = '3. Leave "Current Value" blank or unchanged to keep the existing value.'
    ws2.getCell('A5').value = '4. Upload this file back using Settings → Business Rules → Upload Excel.'
    ws2.getCell('A6').value = '5. Only rows with changed values will be updated. Blank values are skipped.'
    ws2.getColumn(1).width = 80

    const buf = await wb.xlsx.writeBuffer()
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="business-rules.xlsx"')
    res.send(Buffer.from(buf))
  }

  @Post('rules/import')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async importRules(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded')
    if (!file.originalname.endsWith('.xlsx') && !file.originalname.endsWith('.xls')) {
      throw new BadRequestException('Only .xlsx or .xls files are accepted')
    }

    const snapshot = await this.configService.getAll(user.companyId, false)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(file.buffer as unknown as Parameters<typeof wb.xlsx.load>[0])
    const ws = wb.getWorksheet('Business Rules')
    if (!ws) throw new BadRequestException('Sheet "Business Rules" not found in the uploaded file')

    const updated: string[] = []
    const errors: string[] = []
    const RISK_KEYS_SET = new Set(RISK_WEIGHT_KEYS as string[])
    const newWeights: Record<string, number> = {}

    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return // skip header
      const key = String(row.getCell(2).value ?? '').trim()
      const rawVal = String(row.getCell(4).value ?? '').trim()
      if (!key || !rawVal) return

      const entry = snapshot[key]
      if (!entry) return // unknown key — skip silently

      // Skip if value unchanged
      const currentStr = String(entry.value ?? '')
      if (rawVal === currentStr) return

      // Validate type
      if (entry.dataType === 'NUMBER') {
        const n = parseFloat(rawVal)
        if (isNaN(n)) { errors.push(`Row ${rowNum} (${key}): "${rawVal}" is not a valid number`); return }
        if (entry.minValue != null && n < Number(entry.minValue)) {
          errors.push(`Row ${rowNum} (${key}): ${n} is below minimum ${String(entry.minValue)}`); return
        }
        if (entry.maxValue != null && n > Number(entry.maxValue)) {
          errors.push(`Row ${rowNum} (${key}): ${n} exceeds maximum ${String(entry.maxValue)}`); return
        }
        if (RISK_KEYS_SET.has(key)) newWeights[key] = n
      }
      if (entry.dataType === 'BOOLEAN' && rawVal !== 'true' && rawVal !== 'false') {
        errors.push(`Row ${rowNum} (${key}): must be "true" or "false"`); return
      }

      updated.push(key)
    })

    if (errors.length > 0) {
      throw new BadRequestException({ message: 'Validation errors in uploaded file', errors })
    }

    // Validate risk weight sum if any weight changed
    if (Object.keys(newWeights).length > 0) {
      const aging = newWeights[ConfigKey.RISK_WEIGHT_AGING] ?? (snapshot[ConfigKey.RISK_WEIGHT_AGING]?.value as number)
      const amount = newWeights[ConfigKey.RISK_WEIGHT_AMOUNT] ?? (snapshot[ConfigKey.RISK_WEIGHT_AMOUNT]?.value as number)
      const history = newWeights[ConfigKey.RISK_WEIGHT_HISTORY] ?? (snapshot[ConfigKey.RISK_WEIGHT_HISTORY]?.value as number)
      const check = this.configService.validateWeightSum(Number(aging), Number(amount), Number(history))
      if (!check.valid) {
        throw new BadRequestException(`Risk weights must sum to 1.0. Would result in: ${check.sum}`)
      }
    }

    // Apply updates
    let applied = 0
    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return
      const key = String(row.getCell(2).value ?? '').trim()
      const rawVal = String(row.getCell(4).value ?? '').trim()
      if (!key || !rawVal || !updated.includes(key)) return

      const entry = snapshot[key]
      if (!entry) return

      let parsed: unknown = rawVal
      if (entry.dataType === 'NUMBER') parsed = parseFloat(rawVal)
      else if (entry.dataType === 'BOOLEAN') parsed = rawVal === 'true'
      else if (entry.dataType === 'JSON') {
        try { parsed = JSON.parse(rawVal) } catch { return }
      }

      this.configService.set(user.companyId, key as ConfigKey, parsed, user.userId).catch(() => undefined)
      applied++
    })

    return { applied, total: updated.length, message: `Updated ${applied} rule(s) successfully` }
  }

  @Patch('rules/:key')
  async setRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Body('value') value: unknown,
  ) {
    // Risk weight sum validation
    if (RISK_WEIGHT_KEYS.includes(key as ConfigKey)) {
      const snapshot = await this.configService.getAll(user.companyId)
      const weights: Record<string, number> = {
        [ConfigKey.RISK_WEIGHT_AGING]: Number(snapshot[ConfigKey.RISK_WEIGHT_AGING]?.value ?? 0.5),
        [ConfigKey.RISK_WEIGHT_AMOUNT]: Number(snapshot[ConfigKey.RISK_WEIGHT_AMOUNT]?.value ?? 0.3),
        [ConfigKey.RISK_WEIGHT_HISTORY]: Number(snapshot[ConfigKey.RISK_WEIGHT_HISTORY]?.value ?? 0.2),
      }
      weights[key] = Number(value)
      const check = this.configService.validateWeightSum(
        weights[ConfigKey.RISK_WEIGHT_AGING],
        weights[ConfigKey.RISK_WEIGHT_AMOUNT],
        weights[ConfigKey.RISK_WEIGHT_HISTORY],
      )
      if (!check.valid) {
        throw new BadRequestException(`Risk weights must sum to 1.0. Would result in: ${check.sum}`)
      }
    }
    await this.configService.set(user.companyId, key as ConfigKey, value, user.userId)
    return { key, value }
  }

  @Delete('rules/:key')
  @HttpCode(HttpStatus.OK)
  async resetRule(@CurrentUser() user: AuthenticatedUser, @Param('key') key: string) {
    await this.configService.reset(user.companyId, key as ConfigKey)
    return { key, reset: true }
  }

  @Post('rules/reset-all')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  async resetAllRules(
    @CurrentUser() user: AuthenticatedUser,
    @Body('confirm') confirm: string,
  ) {
    if (confirm !== 'reset') throw new BadRequestException('Body must include { "confirm": "reset" }')
    await this.configService.resetAll(user.companyId)
    return { ok: true, message: 'All custom rules have been reset to system defaults' }
  }

  // ── Permissions ───────────────────────────────────────────────────────────────

  @Get('me/permissions')
  @Roles('ADMIN', 'OPERATIONS_MANAGER', 'STAFF')
  getMyPermissions(@CurrentUser() user: AuthenticatedUser) {
    return this.settings.getMyPermissions(user.companyId, user.userId)
  }

  // ── Team ──────────────────────────────────────────────────────────────────────

  @Get('team')
  @Roles('ADMIN')
  listTeam(@CurrentUser() user: AuthenticatedUser) {
    return this.settings.listTeam(user.companyId)
  }

  @Patch('team/:userId')
  @Roles('ADMIN')
  updateTeamMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() dto: { role?: 'ADMIN' | 'OPERATIONS_MANAGER' | 'STAFF'; moduleAccess?: string[] },
  ) {
    return this.settings.updateTeamMember(user.companyId, userId, user.userId, dto)
  }

  @Delete('team/:userId')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  deactivateTeamMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
  ) {
    return this.settings.deactivateTeamMember(user.companyId, userId, user.userId)
  }

  @Get('team/pending-invitations')
  @Roles('ADMIN')
  getPendingInvitations(@CurrentUser() user: AuthenticatedUser) {
    return this.settings.getPendingInvitations(user.companyId)
  }

  @Post('team/pending-invitations/:invitationId/resend')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  resendInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('invitationId') invitationId: string,
  ) {
    return this.settings.resendInvitation(user.companyId, invitationId)
  }

  @Delete('team/pending-invitations/:invitationId')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  revokeInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('invitationId') invitationId: string,
  ) {
    return this.settings.revokeInvitation(invitationId)
  }

  @Post('team/invite')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  inviteTeamMember(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { email: string; role: 'ADMIN' | 'OPERATIONS_MANAGER' | 'STAFF'; moduleAccess?: string[] },
  ) {
    return this.settings.inviteTeamMember(user.companyId, dto)
  }
}
