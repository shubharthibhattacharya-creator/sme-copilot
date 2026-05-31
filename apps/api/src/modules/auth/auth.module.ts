import { Module } from '@nestjs/common'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { ClerkAuthGuard } from './guards/clerk.guard'
import { RolesGuard } from './guards/roles.guard'
import { ModuleAccessGuard } from '../../common/guards/module-access.guard'
import { APP_GUARD } from '@nestjs/core'

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    ClerkAuthGuard,
    RolesGuard,
    ModuleAccessGuard,
    // Guards run in order: auth → roles → module access
    { provide: APP_GUARD, useClass: ClerkAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ModuleAccessGuard },
  ],
  exports: [ClerkAuthGuard],
})
export class AuthModule {}
