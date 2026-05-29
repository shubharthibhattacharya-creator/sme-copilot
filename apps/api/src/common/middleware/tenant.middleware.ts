import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common'
import type { Request, Response, NextFunction } from 'express'
import { PrismaService } from '../../prisma/prisma.service'

// Augment the Express Request with our tenant context
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      companyId?: string
    }
  }
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    // req.user is already populated by the ClerkGuard at this point.
    // The user record carries companyId, so we just propagate it to req.
    const user = (req as Request & { user?: { companyId: string } }).user
    if (user?.companyId) {
      req.companyId = user.companyId
    }
    next()
  }
}
