import { ArgumentsHost, Catch, ExceptionFilter, HttpException, PayloadTooLargeException } from '@nestjs/common';

/** A file over the transport limit is refused by the upload library before our own check can name its size: say it in plain words. */
@Catch(PayloadTooLargeException)
export class UploadTooLargeFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<{ status(c: number): { json(b: unknown): void } }>();
    res.status(413).json({ success: false, statusCode: 413, message: 'This file is more than 12 MB. Upload one under 5 MB (a photo saved at a smaller size, or exported as JPG, is usually enough).', timestamp: new Date().toISOString() });
  }
}
