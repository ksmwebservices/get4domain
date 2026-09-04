import type { ReactNode } from 'react';
import type { ThemeTokens } from '../types';
import ThemeScope from '../theme/ThemeScope';
import EngineBottomNav, { type BottomNavConfig } from './EngineBottomNav';

/**
 * The base frame every industry site composes: applies the industry theme (ThemeScope)
 * and adds the mobile sticky action bar automatically. Reserves bottom space on mobile
 * so content never hides behind the bar. Keeping the bar here (not per-industry) is what
 * makes it a guaranteed base capability across all industries and sub-categories.
 */
export default function EngineSiteFrame({
  tokens,
  bottomNav,
  children,
}: {
  tokens: ThemeTokens;
  bottomNav: BottomNavConfig;
  children: ReactNode;
}) {
  return (
    <ThemeScope tokens={tokens} className="min-h-screen pb-16 md:pb-0">
      {children}
      <EngineBottomNav {...bottomNav} />
    </ThemeScope>
  );
}
