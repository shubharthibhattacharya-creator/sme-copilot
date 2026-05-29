import { Module } from '@nestjs/common'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { ClerkAuthGuard } from './guards/clerk.guard'
import { APP_GUARD } from '@nestjs/core'

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    ClerkAuthGuard,
    // Apply ClerkAuthGuard globally — individual routes override with @Public()
    {
      provide: APP_GUARD,
      useClass: ClerkAuthGuard,
    },
  ],
  exports: [ClerkAuthGuard],
})
export class AuthModule {}
