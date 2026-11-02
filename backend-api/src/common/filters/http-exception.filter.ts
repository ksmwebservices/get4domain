import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

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
    if (field && !fields.includes(field.split('.').pop() as string)) fields.push(field.split('.').pop() as string);
    if (!parts.includes(text)) parts.push(text);
  }
  const shown = parts.slice(0, 4).join('. ');
  return { message: `${shown}${parts.length > 4 ? ` (and ${parts.length - 4} more)` : ''}. Check those details and try again.`, fields };
}

/**
 * Prisma errors a client can act on, with a fixed sentence each. The Prisma message itself is never sent: it contains the
 * server's file path, the failing call and the constraint name.
 */
const PRISMA_CLIENT_ERRORS: Record<string, { status: number; message: string }> = {
  P2025: { status: HttpStatus.NOT_FOUND, message: 'That item could not be found.' },
  P2002: { status: HttpStatus.CONFLICT, message: 'That already exists.' },
  P2003: { status: HttpStatus.CONFLICT, message: 'This item is still linked to other records (for example invoices or bookings), so it cannot be removed or changed that way. Remove or reassign those first.' },
  P2014: { status: HttpStatus.CONFLICT, message: 'This item is still linked to other records (for example invoices or bookings), so it cannot be removed or changed that way. Remove or reassign those first.' },
};
const GENERIC_SERVER_ERROR = 'Something went wrong on our side. Please try again.';
const PROVIDER_ERROR = 'A connected provider (payments, messaging or similar) could not complete this request. Please try again in a moment.';

/** What the client is told about an error that is not a deliberate HttpException. The real detail goes to the server log only. */
interface Classified {
  status: number;
  message: string;
  /** Present for 5xx: shown to the client and written next to the full error in the log so support can find it. */
  reference?: string;
  /** Short note for the server log of a mapped (non-5xx) error. */
  logNote?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const classified = this.classify(exception);

    const statusCode =
      classified?.status ??
      (exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR);

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    // A deliberate HttpException keeps its own message. Anything else uses the classified, fixed sentence: raw error text
    // (file paths, SQL, Prisma invocation text, provider detail) must never reach the client.
    const message =
      classified?.message ??
      (exceptionResponse && typeof exceptionResponse === 'object' && 'message' in exceptionResponse
        ? (exceptionResponse as { message: string | string[] }).message
        : exception instanceof Error
          ? exception.message
          : 'Internal server error');

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // Log the full error detail, not just the route. Some SDKs (e.g. Razorpay)
      // reject with a plain object rather than an Error, so `instanceof Error`
      // fails and we would otherwise lose the message and stack entirely.
      const ref = classified?.reference ? `[${classified.reference}] ` : '';
      this.logger.error(
        `${ref}${request.method} ${request.url} -> ${statusCode}: ${this.describe(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else if (classified?.logNote) {
      this.logger.warn(`${request.method} ${request.url} -> ${statusCode} (${classified.logNote})`);
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
      data: details ?? (classified?.reference ? { reference: classified.reference } : Object.keys(extra).length ? extra : fieldInfo),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Decide what a client may be told about anything that is not a deliberate HttpException (those return null: their message
   * was written to be shown). Prisma constraint errors become 404/409 with a fixed sentence; provider SDK objects become 502;
   * everything else becomes a generic 500 carrying only a reference id.
   */
  private classify(exception: unknown): Classified | null {
    if (exception instanceof HttpException) return null;

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = PRISMA_CLIENT_ERRORS[exception.code];
      if (mapped) return { status: mapped.status, message: mapped.message, logNote: `Prisma ${exception.code}` };
    }

    const reference = randomBytes(4).toString('hex');
    // A payment/messaging SDK rejecting with a plain object like { statusCode, error: { code, description } } (Razorpay does this).
    const providerShaped =
      exception !== null && typeof exception === 'object' && !(exception instanceof Error) &&
      typeof (exception as { error?: unknown }).error === 'object' && (exception as { error?: unknown }).error !== null;
    if (providerShaped) return { status: HttpStatus.BAD_GATEWAY, message: `${PROVIDER_ERROR} Reference: ${reference}`, reference };
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: `${GENERIC_SERVER_ERROR} Reference: ${reference}`, reference };
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
