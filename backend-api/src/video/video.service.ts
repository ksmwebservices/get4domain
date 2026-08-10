import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { WalletService } from '../wallet/wallet.service';
import { GenerateVideoDto } from './dto/generate-video.dto';

export type VideoProvider = 'runway' | 'heygen' | 'none';
export type VideoStatus = 'processing' | 'done' | 'failed';

const VIDEO_COST_FALLBACK_PAISE = 5000; // ₹50 default; admin Pricing Manager overrides
// Public sample clip shown in MOCK mode (no provider key configured) so the full
// generate → poll → preview UX is demonstrable before Runway/HeyGen go live.
const MOCK_VIDEO_URL = 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4';

interface SubmitResult { jobId: string; provider: VideoProvider; status: VideoStatus; mock: boolean }

/**
 * Video/Reel generation — provider-abstracted, admin-selectable (mock-first).
 * Admin sets EITHER a Runway ML or a HeyGen key in Admin → Integrations (`video`
 * category); the active provider is whichever is configured. Generation is async:
 * submit returns a jobId, the client polls status until the URL is ready.
 *
 * NOTE: the real Runway/HeyGen request/response shapes below are implemented to
 * their documented v1/v2 APIs but were not live-tested from this environment —
 * verify once real keys are configured. Everything degrades to MOCK when unkeyed.
 */
@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);

  constructor(
    private readonly settings: PlatformSettingsService,
    private readonly wallet: WalletService,
  ) {}

  async activeProvider(): Promise<VideoProvider> {
    if (await this.settings.getResolvedValue('video', 'runway_api_key')) return 'runway';
    if (await this.settings.getResolvedValue('video', 'heygen_api_key')) return 'heygen';
    return 'none';
  }

  async cost(): Promise<number> {
    return this.wallet.getRate('video_generation', VIDEO_COST_FALLBACK_PAISE);
  }

  async generate(vendorId: string, dto: GenerateVideoDto, internal = false): Promise<SubmitResult> {
    const provider = await this.activeProvider();

    if (provider === 'none') {
      // MOCK — no charge, returns a placeholder job that completes instantly.
      this.logger.log('[MOCK] video generate (no provider configured)');
      return { jobId: `mock_${Date.now()}`, provider: 'none', status: 'processing', mock: true };
    }

    const price = await this.cost();
    if (!internal && !(await this.wallet.hasSufficientBalance(vendorId, price))) {
      throw new BadRequestException('INSUFFICIENT_WALLET_BALANCE');
    }

    let jobId: string;
    try {
      jobId = provider === 'runway' ? await this.submitRunway(dto) : await this.submitHeygen(dto);
    } catch (err) {
      this.logger.error(`${provider} submit failed: ${err instanceof Error ? err.message : 'unknown'}`);
      throw new BadRequestException(`Video provider (${provider}) could not start the job. Please try again.`);
    }

    // Charge on successful submit (internal staff are free).
    if (!internal) {
      await this.wallet.deduct(vendorId, price, `AI video generated (${provider})`, `ai_video_${provider}`);
    }
    return { jobId, provider, status: 'processing', mock: false };
  }

  async status(provider: VideoProvider, jobId: string): Promise<{ status: VideoStatus; url: string | null }> {
    if (provider === 'none' || jobId.startsWith('mock_')) {
      return { status: 'done', url: MOCK_VIDEO_URL };
    }
    try {
      return provider === 'runway' ? await this.statusRunway(jobId) : await this.statusHeygen(jobId);
    } catch (err) {
      this.logger.error(`${provider} status failed: ${err instanceof Error ? err.message : 'unknown'}`);
      return { status: 'failed', url: null };
    }
  }

  // ---- Runway ML (text/image-to-video) -------------------------------------
  private async submitRunway(dto: GenerateVideoDto): Promise<string> {
    const key = await this.settings.getResolvedValue('video', 'runway_api_key');
    const res = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'X-Runway-Version': '2024-11-06',
      },
      body: JSON.stringify({
        model: 'gen3a_turbo',
        promptText: dto.prompt ?? '',
        promptImage: dto.imageUrl ?? undefined,
        duration: 5,
        ratio: '768:1280',
      }),
    });
    const data = (await res.json()) as { id?: string };
    if (!res.ok || !data.id) throw new Error(`runway ${res.status}: ${JSON.stringify(data)}`);
    return data.id;
  }

  private async statusRunway(jobId: string): Promise<{ status: VideoStatus; url: string | null }> {
    const key = await this.settings.getResolvedValue('video', 'runway_api_key');
    const res = await fetch(`https://api.dev.runwayml.com/v1/tasks/${jobId}`, {
      headers: { Authorization: `Bearer ${key}`, 'X-Runway-Version': '2024-11-06' },
    });
    const data = (await res.json()) as { status?: string; output?: string[] };
    if (!res.ok) throw new Error(`runway status ${res.status}`);
    if (data.status === 'SUCCEEDED') return { status: 'done', url: data.output?.[0] ?? null };
    if (data.status === 'FAILED') return { status: 'failed', url: null };
    return { status: 'processing', url: null };
  }

  // ---- HeyGen (avatar presenter) -------------------------------------------
  private async submitHeygen(dto: GenerateVideoDto): Promise<string> {
    const key = await this.settings.getResolvedValue('video', 'heygen_api_key');
    const res = await fetch('https://api.heygen.com/v2/video/generate', {
      method: 'POST',
      headers: { 'X-Api-Key': key ?? '', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_inputs: [
          {
            character: { type: 'avatar', avatar_id: 'default', avatar_style: 'normal' },
            voice: { type: 'text', input_text: dto.script ?? '', voice_id: 'default' },
          },
        ],
        dimension: { width: 720, height: 1280 },
      }),
    });
    const data = (await res.json()) as { data?: { video_id?: string } };
    if (!res.ok || !data.data?.video_id) throw new Error(`heygen ${res.status}: ${JSON.stringify(data)}`);
    return data.data.video_id;
  }

  private async statusHeygen(jobId: string): Promise<{ status: VideoStatus; url: string | null }> {
    const key = await this.settings.getResolvedValue('video', 'heygen_api_key');
    const res = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${jobId}`, {
      headers: { 'X-Api-Key': key ?? '' },
    });
    const data = (await res.json()) as { data?: { status?: string; video_url?: string } };
    if (!res.ok) throw new Error(`heygen status ${res.status}`);
    const s = data.data?.status;
    if (s === 'completed') return { status: 'done', url: data.data?.video_url ?? null };
    if (s === 'failed') return { status: 'failed', url: null };
    return { status: 'processing', url: null };
  }
}
