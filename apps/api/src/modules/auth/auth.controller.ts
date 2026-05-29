import { Controller, Post, HttpCode, HttpStatus, Headers, RawBodyRequest, Req } from '@nestjs/common'
import { AuthService } from './auth.service'
import { Public } from '../../common/decorators/public.decorator'
import type { Request } from 'express'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Clerk webhook — provisions User + Company on sign-up
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleClerkWebhook(
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    return this.authService.handleWebhook(
      { 'svix-id': svixId, 'svix-timestamp': svixTimestamp, 'svix-signature': svixSignature },
      req.rawBody ?? Buffer.alloc(0),
    )
  }

  /**
   * Self-provisioning endpoint called by the frontend after Clerk sign-up.
   * Idempotent — safe to call multiple times. No webhook needed.
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.OK)
  async register(@Req() req: Request) {
    const authHeader = req.headers.authorization ?? ''
    return this.authService.registerFromToken(authHeader.replace('Bearer ', '').trim())
  }
}
