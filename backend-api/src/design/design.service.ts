import { Injectable } from '@nestjs/common';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { SAMPLE_DESIGN_TEMPLATES, DesignTemplateDef } from './design.templates';

@Injectable()
export class DesignService {
  constructor(private readonly settings: PlatformSettingsService) {}

  /** Publishable Polotno key for the embedded editor (client-side). Null when the
   *  subscription key hasn't been configured in Admin → Integrations → Design. */
  async config(): Promise<{ polotnoKey: string | null; hasKey: boolean }> {
    const polotnoKey = await this.settings.getResolvedValue('design', 'polotno_api_key');
    return { polotnoKey: polotnoKey || null, hasKey: !!polotnoKey };
  }

  /** Built-in sample templates (metadata + Polotno scene JSON). */
  templates(): DesignTemplateDef[] {
    return SAMPLE_DESIGN_TEMPLATES;
  }
}
