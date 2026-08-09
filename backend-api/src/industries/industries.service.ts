import { Injectable, NotFoundException } from '@nestjs/common';
import {
  INDUSTRY_CONFIGS,
  IndustryConfig,
  getIndustryConfig,
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
    if (!INDUSTRY_CONFIGS[key]) {
      throw new NotFoundException(`Unknown industry: ${key}`);
    }
    return getIndustryConfig(key);
  }
}
