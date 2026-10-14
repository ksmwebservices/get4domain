import { BadRequestException, Controller, Post, Query, Req, UploadedFile, UseFilters, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UploadTooLargeFilter } from './upload-too-large.filter';
import { MEDIA_KINDS, MediaKind, MediaService, StoredImage } from './media.service';

// Minimal shapes so we don't need @types/multer / @types/express.
interface UploadedImage { buffer: Buffer; mimetype: string; size: number; originalname: string }
interface ReqLike { protocol: string; get(name: string): string | undefined; user?: { sub?: string } }

/** multer's own limit is above our 5 MB rule on purpose, so the vendor is told the real size of the file instead of a bare "too large". */
const TRANSPORT_LIMIT = 12 * 1024 * 1024;

@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(private readonly media: MediaService) {}

  @Post()
  @ApiOperation({ summary: 'Upload a picture (png, jpg, webp, gif or a script-free svg; up to 5 MB). It is cleaned (no location data), resized for the web, counted against your plan, and the original is kept. A logo also gives a favicon and a share image.' })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'kind', required: false, enum: MEDIA_KINDS as unknown as string[] })
  @UseFilters(UploadTooLargeFilter)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: TRANSPORT_LIMIT } }))
  async upload(@UploadedFile() file: UploadedImage, @Req() req: ReqLike, @Query('kind') kind?: string): Promise<StoredImage> {
    if (!file || !file.buffer) throw new BadRequestException('No picture was received. Choose a file and try again.');
    const k = (kind ?? 'OTHER').toUpperCase() as MediaKind;
    if (!MEDIA_KINDS.includes(k)) throw new BadRequestException('Unknown kind of picture.');
    // Absolute URL so it works embedded in invoices/emails and the browser alike.
    const base = process.env.PUBLIC_API_URL ?? `${req.protocol}://${req.get('host')}`;
    return this.media.store(req.user?.sub ?? 'anonymous', k, file, base);
  }
}
