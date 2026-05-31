import {
  CanActivate, ExecutionContext, ForbiddenException,
  Injectable, UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { REQUIRE_MODULE_KEY } from '../decorators/require-module.decorator'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'
import { ROLE_DEFAULT_MODULES, type AppModule } from '../permissions/role-defaults'
import type { AuthenticatedUser } from '@opsc/types'
import type { Request } from 'express'

@Injectable()
export class ModuleAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Skip for public endpoints (webhooks, etc.)
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const requiredModule = this.reflector.getAllAndOverride<AppModule>(REQUIRE_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!requiredModule) return true

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>()
    const user = request.user
    if (!user) throw new UnauthorizedException()

    const effectiveModules: string[] =
      user.moduleAccess?.length > 0
        ? user.moduleAccess
        : (ROLE_DEFAULT_MODULES[user.role as keyof typeof ROLE_DEFAULT_MODULES] ?? [])

    if (!effectiveModules.includes(requiredModule)) {
      throw new ForbiddenException(
        `You do not have access to the ${requiredModule} module. Contact your firm administrator to request access.`,
      )
    }

    return true
  }
}
