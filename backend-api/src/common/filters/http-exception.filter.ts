import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const message =
      exceptionResponse && typeof exceptionResponse === 'object' && 'message' in exceptionResponse
        ? (exceptionResponse as { message: string | string[] }).message
        : exception instanceof Error
          ? exception.message
          : this.extractMessage(exception);

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // Log the full error detail, not just the route. Some SDKs (e.g. Razorpay)
      // reject with a plain object rather than an Error, so `instanceof Error`
      // fails and we would otherwise lose the message and stack entirely.
      this.logger.error(
        `${request.method} ${request.url} -> ${statusCode}: ${this.describe(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(statusCode).json({
      success: false,
      statusCode,
      message,
      data: null,
      timestamp: new Date().toISOString(),
    });
  }

  /** Best-effort human-readable message for non-Error / non-HttpException throws. */
  private extractMessage(exception: unknown): string {
    if (exception && typeof exception === 'object') {
      const err = exception as { error?: { description?: string }; message?: string };
      if (err.error?.description) return err.error.description;
      if (typeof err.message === 'string' && err.message) return err.message;
    }
    return 'Internal server error';
  }

  /** Full description of any thrown value for server logs (Error, plain object, or primitive). */
  private describe(exception: unknown): string {
    if (exception instanceof Error) return `${exception.name}: ${exception.message}`;
    if (exception && typeof exception === 'object') {
      try {
        return JSON.stringify(exception);
      } catch {
        return String(exception);
      }
    }
    return String(exception);
  }
}
