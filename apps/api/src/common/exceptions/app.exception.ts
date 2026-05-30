import { HttpException } from '@nestjs/common'

/**
 * Base class for all OpsCopilot typed exceptions.
 * Always carries a machine-readable errorCode, a plain-English userMessage,
 * a helpful suggestion, and an optional technical detail that is LOGGED ONLY
 * and never sent to the browser.
 */
export class AppException extends HttpException {
  constructor(
    public readonly errorCode: string,
    public readonly userMessage: string,
    public readonly suggestion: string,
    public readonly httpStatus: number,
    public readonly technicalDetail?: string,
  ) {
    super({ errorCode, userMessage, suggestion }, httpStatus)
  }
}
