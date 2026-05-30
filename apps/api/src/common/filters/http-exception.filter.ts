import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { Request, Response } from 'express'

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR

    const rawMessage =
      exception instanceof HttpException
        ? exception.message
        : exception instanceof Error
          ? exception.message
          : 'Internal server error'

    const message = rawMessage

    const stack = exception instanceof Error ? exception.stack : undefined

    if (status >= 500) {
      this.logger.error(`[${request.method}] ${request.url} — ${rawMessage}`, stack)
    }

    response.status(status).json({
      statusCode: status,
      message,
      // Include stack in non-200 responses for easier debugging (remove before GA)
      ...(status >= 500 && stack ? { stack: stack.split('\n').slice(0, 8) } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
    })
  }
}
