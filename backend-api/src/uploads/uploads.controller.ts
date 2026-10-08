import {
  BadRequestException, Controller, InternalServerErrorException, Logger, Post, Req, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { DECLARED_TO_EXT, MAX_UPLOAD_BYTES, detectImage, svgIsSafe, uploadsDir } from './uploads.util';

// Minimal shapes so we don't need @types/multer / @types/express.
interface UploadedImage { buffer: Buffer; mimetype: string; size: number; originalname: string }
interface ReqLike { protocol: string; get(name: string): string | undefined }

@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  private readonly logger = new Logger(UploadsController.name);

  @Post()
  @ApiOperation({ summary: 'Upload an image (png, jpg, webp, gif or a script-free svg; max 5 MB). Stored on the server disk, served at /uploads/*' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  upload(@UploadedFile() file: UploadedImage, @Req() req: ReqLike): { url: string } {
    if (!file || !file.buffer) throw new BadRequestException('No file uploaded');
    const declared = DECLARED_TO_EXT[file.mimetype];
    if (!declared) throw new BadRequestException('Only image files are allowed (png, jpg, webp, gif, svg)');

    // The BYTES decide: a file renamed to .png, or an HTML page labelled image/png, is refused.
    const detected = detectImage(file.buffer);
    if (!detected || detected.ext !== declared) throw new BadRequestException('That file is not a valid image of the type it claims to be. Please upload a png, jpg, webp or gif.');
    if (detected.ext === '.svg' && !svgIsSafe(file.buffer.toString('utf8'))) {
      throw new BadRequestException('This SVG contains scripts or external links and cannot be uploaded. Export it as a png instead.');
    }

    const dir = uploadsDir();
    const name = `${Date.now()}_${randomBytes(6).toString('hex')}${detected.ext}`;
    try {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, name), file.buffer);
    } catch (e) {
      // e.g. EACCES when the uploads volume is not writable by the non-root app user — log the real cause, tell the vendor something useful
      this.logger.error(`Could not write upload to ${dir}: ${e instanceof Error ? e.message : String(e)}`);
      throw new InternalServerErrorException('The image could not be saved on the server. Please try again in a moment; if it keeps failing, contact support.');
    }

    // Absolute URL so it works embedded in invoices/emails and the browser alike.
    const base = process.env.PUBLIC_API_URL ?? `${req.protocol}://${req.get('host')}`;
    return { url: `${base}/uploads/${name}` };
  }
}
