import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { Prisma } from '@opsc/database'
import type { Request, Response } from 'express'
import { AppException } from '../exceptions'

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter')

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    const req = request as unknown as Record<string, unknown>
    const companyId = req['company'] as { id?: string } | undefined
    const userId = req['user'] as { id?: string } | undefined
    const companyIdStr = companyId?.id ?? 'unknown'
    const userIdStr = userId?.id ?? 'unknown'
    const path = request.url
    const method = request.method

    // Defaults — catch-all for truly unexpected errors
    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let errorCode = 'INTERNAL_ERROR'
    let userMessage = 'Something went wrong. Our team has been notified.'
    let suggestion = 'Please try again. If the problem continues, contact support.'
    let technicalDetail = ''
    let shouldLogError = true

    if (exception instanceof AppException) {
      // Our typed exceptions — use their values directly
      status = exception.httpStatus
      errorCode = exception.errorCode
      userMessage = exception.userMessage
      suggestion = exception.suggestion
      technicalDetail = exception.technicalDetail ?? ''
      // 4xx client errors are expected business logic — log at warn level only
      shouldLogError = status >= 500
    } else if (exception instanceof HttpException) {
      // NestJS built-ins: ValidationPipe, UnauthorizedException, etc.
      status = exception.getStatus()
      const body = exception.getResponse() as Record<string, unknown>
      technicalDetail = JSON.stringify(body)
      shouldLogError = status >= 500

      if (status === HttpStatus.BAD_REQUEST && Array.isArray(body?.['message'])) {
        // ValidationPipe gives array of field errors — humanise them
        errorCode = 'VALIDATION_ERROR'
        const firstError = (body['message'] as string[])[0] ?? 'Invalid input'
        userMessage = `Please check your input: ${humaniseValidationError(firstError)}`
        suggestion = 'Correct the highlighted fields and try again.'
      } else if (status === HttpStatus.UNAUTHORIZED) {
        errorCode = 'UNAUTHORIZED'
        userMessage = 'Your session has expired. Please sign in again.'
        suggestion = 'Click Sign In to continue.'
        shouldLogError = false
      } else if (status === HttpStatus.FORBIDDEN) {
        errorCode = 'FORBIDDEN'
        userMessage = 'You do not have permission to do this.'
        suggestion = 'Contact your firm administrator if you need access.'
        shouldLogError = false
      } else if (status === HttpStatus.NOT_FOUND) {
        errorCode = 'NOT_FOUND'
        userMessage = 'This item could not be found.'
        suggestion = 'It may have been deleted, or you may not have access.'
        shouldLogError = false
      } else if (status === HttpStatus.CONFLICT) {
        errorCode = 'CONFLICT'
        const msg = typeof body?.['message'] === 'string' ? body['message'] : 'Conflict'
        userMessage = msg
        suggestion = 'Check for duplicate entries or conflicting state.'
        shouldLogError = false
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Prisma database errors — never expose these to users
      technicalDetail = `Prisma ${exception.code}: ${exception.message}`
      shouldLogError = true

      if (exception.code === 'P2002') {
        // Unique constraint violation
        errorCode = 'DUPLICATE_ENTRY'
        const field = (exception.meta?.['target'] as string[] | undefined)?.join(', ') ?? 'field'
        userMessage = `This ${field} already exists.`
        suggestion = 'Use a different value or find the existing record.'
        status = HttpStatus.CONFLICT
        shouldLogError = false
      } else if (exception.code === 'P2025') {
        // Record not found
        errorCode = 'NOT_FOUND'
        userMessage = 'This record could not be found.'
        suggestion = 'It may have been deleted. Refresh and try again.'
        status = HttpStatus.NOT_FOUND
        shouldLogError = false
      } else if (exception.code === 'P2003') {
        // Foreign key constraint
        errorCode = 'DEPENDENCY_EXISTS'
        userMessage = 'This item cannot be deleted because other records depend on it.'
        suggestion = 'Remove the related records first, then try again.'
        status = HttpStatus.CONFLICT
        shouldLogError = false
      }
    } else if (exception instanceof Prisma.PrismaClientUnknownRequestError) {
      technicalDetail = exception.message
    } else if (exception instanceof Error) {
      technicalDetail = exception.message
    }

    // TECHNICAL LOG — full detail, never sent to browser
    if (shouldLogError) {
      this.logger.error(
        `[${errorCode}] ${method} ${path} | company:${companyIdStr} user:${userIdStr}`,
        technicalDetail || (exception instanceof Error ? exception.stack : String(exception)),
      )
    } else {
      this.logger.warn(
        `[${errorCode}] ${method} ${path} | company:${companyIdStr} user:${userIdStr} | ${technicalDetail}`,
      )
    }

    // USER-SAFE RESPONSE — no stack trace, no internal detail, ever
    response.status(status).json({
      statusCode: status,
      errorCode,
      userMessage,
      suggestion,
      timestamp: new Date().toISOString(),
      path,
    })
  }
}

/**
 * Converts NestJS validation messages to plain English.
 * e.g. 'amount must be a positive number' → 'Amount must be a positive number'
 */
function humaniseValidationError(msg: string): string {
  return msg.charAt(0).toUpperCase() + msg.slice(1)
}
