import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/** "createdAt" -> "Created at" */
const words = (field: string): string => { const t = field.replace(/\[\d+\]/g, '').split('.').pop() ?? field; const w = t.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase().trim(); return w.charAt(0).toUpperCase() + w.slice(1); };

/**
 * A validation failure arrives as a list of machine sentences ("property id should not exist", "name should not be empty"). Nobody should read those:
 * turn them into one plain sentence that says which details to fix. A message that is already a plain sentence (our own DTO messages) is kept.
 */
export function plainValidation(messages: string[]): { message: string; fields: string[] } {
  const fields: string[] = []; const parts: string[] = [];
  for (const raw of messages) {
    const m = String(raw);
    let field: string | null = null; let text: string;
    const notExist = /^property ([\w.\[\]]+) should not exist$/.exec(m);
    const empty = /^([\w.\[\]]+) should not be empty$/.exec(m);
    const generic = /^([\w.\[\]]+) (must|should|has|is|are)/.exec(m);
    if (notExist) { field = notExist[1]; text = `${words(field)} cannot be changed here`; }
    else if (empty) { field = empty[1]; text = `${words(field)} is required`; }
    else if (generic && !/^[A-Z]/.test(m)) { field = generic[1]; text = `${words(field)} does not look right`; }
    else text = m.endsWith('.') ? m.slice(0, -1) : m;
    if (field) fields.push(field.split('.').pop() as string);
    if (!parts.includes(text)) parts.push(text);
  }
  const shown = parts.slice(0, 4).join('. ');
  return { message: `${shown}${parts.length > 4 ? ` (and ${parts.length - 4} more)` : ''}. Check those details and try again.`, fields };
}

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

    // An exception may carry structured `details` (e.g. the open invoice that blocked a deal) so a screen can offer a link / override.
    const details =
      exceptionResponse && typeof exceptionResponse === 'object' && 'details' in exceptionResponse
        ? (exceptionResponse as { details: unknown }).details
        : null;

    // Structured, machine-readable reasons (e.g. PLAN_REQUIRED + the feature and plan that unlock it) so a screen can render an upgrade card.
    const extra: Record<string, unknown> = {};
    if (exceptionResponse && typeof exceptionResponse === 'object' && ['PLAN_REQUIRED', 'LIMIT_REACHED'].includes(String((exceptionResponse as Record<string, unknown>).code))) {
      for (const k of ['code', 'feature', 'requiredPlan'] as const) {
        const v = (exceptionResponse as Record<string, unknown>)[k];
        if (typeof v === 'string') extra[k] = v;
      }
    }

    let outMessage: string | string[] = message;
    let fieldInfo: { fields: string[] } | null = null;
    if (statusCode === 400 && Array.isArray(message)) { const p = plainValidation(message); outMessage = p.message; fieldInfo = p.fields.length ? { fields: p.fields } : null; }

    response.status(statusCode).json({
      success: false,
      statusCode,
      message: outMessage,
      ...extra,
      data: details ?? (Object.keys(extra).length ? extra : fieldInfo),
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
