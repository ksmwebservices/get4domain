import {
  BadRequestException, Controller, Post, Req, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

// Minimal shapes so we don't need @types/multer / @types/express.
interface UploadedImage { buffer: Buffer; mimetype: string; size: number; originalname: string }
interface ReqLike { protocol: string; get(name: string): string | undefined }

const MIME_EXT: Record<string, string> = {
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/jpg': '.jpg',
  'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg',
};

@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  @Post()
  @ApiOperation({ summary: 'Upload an image (stored on local VM disk, served at /uploads/*)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  upload(@UploadedFile() file: UploadedImage, @Req() req: ReqLike): { url: string } {
    if (!file || !file.buffer) throw new BadRequestException('No file uploaded');
    const ext = MIME_EXT[file.mimetype];
    if (!ext) throw new BadRequestException('Only image files are allowed (png, jpg, webp, gif, svg)');

    const dir = join(process.cwd(), 'uploads');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const name = `${Date.now()}_${randomBytes(6).toString('hex')}${ext}`;
    writeFileSync(join(dir, name), file.buffer);

    // Absolute URL so it works embedded in invoices/emails and the browser alike.
    const base = process.env.PUBLIC_API_URL ?? `${req.protocol}://${req.get('host')}`;
    return { url: `${base}/uploads/${name}` };
  }
}
