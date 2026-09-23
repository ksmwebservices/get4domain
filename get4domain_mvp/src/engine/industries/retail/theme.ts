import type { ThemeTokens } from '../../types';
import { THEMES } from '../../kit/themes';

/**
 * The default retail palette (purple/pink, light, 14px radius) — unchanged from the
 * kit's existing `THEMES.retail`. Kept as its own export so a future sub-vertical
 * (apparel/electronics/grocery/jewellery, or a per-vendor override) can supply a
 * DIFFERENT ThemeTokens object and get the exact same product grid, PDP and cart
 * structure re-themed for free — no component touches a colour directly, everything
 * reads `--eng-*` custom properties via ThemeScope.
 */
export const retailTheme: ThemeTokens = THEMES.retail;
