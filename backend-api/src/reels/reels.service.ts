import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { WalletService } from '../wallet/wallet.service';
import { RenderReelDto } from './dto/render-reel.dto';
import { MUSIC_TRACKS, MusicTrack } from './reels.tracks';

const REEL_COST_FALLBACK_PAISE = 5000; // ₹50, same ballpark as video_generation
const REMOTION_DIR = join(process.cwd(), 'remotion');

export interface ReelRenderResult {
  status: 'done' | 'not_configured' | 'failed';
  url?: string;
  message?: string;
}

@Injectable()
export class ReelsService {
  private readonly logger = new Logger(ReelsService.name);

  constructor(private readonly wallet: WalletService) {}

  /** Licensed music tracks available for reels (empty until KSM adds cleared tracks). */
  tracks(): MusicTrack[] {
    return MUSIC_TRACKS;
  }

  /** True when the Remotion render workspace has been installed (VM step). */
  private rendererAvailable(): boolean {
    return existsSync(join(REMOTION_DIR, 'render.mjs')) && existsSync(join(REMOTION_DIR, 'node_modules'));
  }

  /**
   * Render a slideshow reel from the vendor's own photos + text + optional licensed
   * music. Heavy work runs in the standalone Remotion workspace (child process) so
   * it never enters the NestJS build; needs headless Chrome + FFmpeg on the VM.
   */
  async render(vendorId: string, dto: RenderReelDto, internal = false): Promise<ReelRenderResult> {
    const track = dto.trackId ? MUSIC_TRACKS.find((t) => t.id === dto.trackId) : undefined;
    if (dto.trackId && !track) throw new BadRequestException('Unknown music track');

    if (!this.rendererAvailable()) {
      return {
        status: 'not_configured',
        message: 'The reel renderer isn’t set up on this server yet. Once installed (Remotion + FFmpeg on the VM), reels render here.',
      };
    }

    const cost = await this.wallet.getRate('video_generation', REEL_COST_FALLBACK_PAISE);
    if (!internal && !(await this.wallet.hasSufficientBalance(vendorId, cost))) {
      throw new BadRequestException('INSUFFICIENT_WALLET_BALANCE');
    }

    // Write render props, then run the standalone renderer.
    const uploads = join(process.cwd(), 'uploads', 'reels');
    if (!existsSync(uploads)) mkdirSync(uploads, { recursive: true });
    const id = `${Date.now()}_${randomBytes(6).toString('hex')}`;
    // Props go to a temp dir (not the public /uploads path); only the MP4 is served.
    const propsPath = join(tmpdir(), `g4d-reel-${id}.props.json`);
    const outPath = join(uploads, `${id}.mp4`);
    writeFileSync(propsPath, JSON.stringify({
      images: dto.images,
      text: dto.text ?? '',
      audioSrc: track?.url ?? null,
      accent: dto.accent ?? '#0f766e',
    }));

    const ok = await this.runRenderer(propsPath, outPath);
    if (!ok) return { status: 'failed', message: 'Reel rendering failed. Please try again.' };

    if (!internal) {
      await this.wallet.deduct(vendorId, cost, 'Reel render', 'reel_render');
    }
    const base = process.env.PUBLIC_API_URL ?? '';
    return { status: 'done', url: `${base}/uploads/reels/${id}.mp4` };
  }

  private runRenderer(propsPath: string, outPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const child = spawn('node', ['render.mjs', propsPath, outPath], { cwd: REMOTION_DIR });
        let err = '';
        child.stderr.on('data', (d) => { err += d.toString(); });
        child.on('error', (e) => { this.logger.error(`reel render spawn failed: ${e.message}`); resolve(false); });
        child.on('close', (code) => {
          if (code === 0) resolve(true);
          else { this.logger.error(`reel render exited ${code}: ${err.slice(0, 500)}`); resolve(false); }
        });
      } catch (e) {
        this.logger.error(`reel render error: ${e instanceof Error ? e.message : e}`);
        resolve(false);
      }
    });
  }
}
