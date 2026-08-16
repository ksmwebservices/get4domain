import { Injectable, NotFoundException } from '@nestjs/common';
import {
  INDUSTRY_CONFIGS,
  IndustryConfig,
  getIndustryConfigWithSkin,
  resolveIndustryKey,
  listIndustries,
} from '../config/industries';

@Injectable()
export class IndustriesService {
  /** All full industry configs (used for admin dropdowns / previews). */
  findAll(): IndustryConfig[] {
    return Object.values(INDUSTRY_CONFIGS);
  }

  /** Lightweight list (key/label/icon) for signup + admin dropdowns. */
  findAllSummary(): { key: string; label: string; icon: string }[] {
    return listIndustries();
  }

  /**
   * Single industry config, used heavily by the frontend to drive per-vendor
   * dashboard rendering. Unknown keys fall back to `general`, except an
   * explicit lookup of a non-existent, non-general key returns 404.
   */
  findOne(key: string): IndustryConfig {
    // Accept canonical keys AND legacy aliases (healthcare→clinic, …); only a
    // genuinely unknown key 404s. Returns the config with its skin attached.
    if (!resolveIndustryKey(key)) {
      throw new NotFoundException(`Unknown industry: ${key}`);
    }
    return getIndustryConfigWithSkin(key);
  }
}
