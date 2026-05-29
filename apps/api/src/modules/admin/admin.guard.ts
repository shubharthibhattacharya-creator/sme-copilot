import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, OnModuleInit, Logger } from '@nestjs/common'
import type { Request } from 'express'

@Injectable()
export class AdminGuard implements CanActivate, OnModuleInit {
  private readonly logger = new Logger(AdminGuard.name)
  private secret!: string

  onModuleInit() {
    const s = process.env['ADMIN_SECRET']
    if (!s || s.length < 32) {
      throw new Error('ADMIN_SECRET must be set and at least 32 characters long')
    }
    this.secret = s
    this.logger.log('AdminGuard initialised')
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>()
    const header = req.headers['x-admin-secret']
    if (!header || header !== this.secret) {
      throw new UnauthorizedException('Invalid admin secret')
    }
    return true
  }
}
