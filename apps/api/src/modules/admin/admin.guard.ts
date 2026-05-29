import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, OnModuleInit, Logger } from '@nestjs/common'
import type { Request } from 'express'

@Injectable()
export class AdminGuard implements CanActivate, OnModuleInit {
  private readonly logger = new Logger(AdminGuard.name)
  private secret!: string

  onModuleInit() {
    const s = process.env['ADMIN_SECRET']
    if (!s || s.length < 32) {
      this.logger.warn('ADMIN_SECRET is not set or is too short — admin endpoints will be unavailable')
    } else {
      this.secret = s
      this.logger.log('AdminGuard initialised')
    }
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.secret) {
      throw new UnauthorizedException('Admin endpoints are disabled: ADMIN_SECRET not configured')
    }
    const req = context.switchToHttp().getRequest<Request>()
    const header = req.headers['x-admin-secret']
    if (!header || header !== this.secret) {
      throw new UnauthorizedException('Invalid admin secret')
    }
    return true
  }
}
