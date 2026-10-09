import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { redactSecrets } from '../utils/redact-secrets';

export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((data) => {
        // A file download or a ready HTML page (invoice, statement, shared link) is sent as it is - wrapping it in JSON would show the vendor's
        // customer a wall of text instead of the page. Handlers declare this with @Header('Content-Type', ...) or by returning a StreamableFile.
        const type = String(response.getHeader?.('Content-Type') ?? '');
        if (data instanceof StreamableFile || (type !== '' && !/json/i.test(type))) return data as unknown as ApiResponse<T>;
        return {
        success: true,
        statusCode: response.statusCode,
        message: 'Success',
        // Defence in depth: no endpoint may ever return a password hash / invite token / key secret.
        data: redactSecrets(data),
        timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
