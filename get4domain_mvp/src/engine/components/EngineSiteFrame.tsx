import type { ReactNode } from 'react';
import type { ThemeTokens } from '../types';
import type { BottomNavItem } from '../kit/model';
import ThemeScope from '../theme/ThemeScope';
import EngineBottomNav from './EngineBottomNav';

/**
 * The base frame every industry site composes: applies the industry theme (ThemeScope)
 * and adds the mobile bottom navigation automatically (Section 9). Reserves bottom space
 * on mobile so content never hides behind the bar. Desktop hides the bar (Section 10).
 */
export default function EngineSiteFrame({
  tokens,
  bottomNav,
  children,
}: {
  tokens: ThemeTokens;
  bottomNav: BottomNavItem[];
  children: ReactNode;
}) {
  return (
    <ThemeScope tokens={tokens} className="min-h-screen pb-20 md:pb-0">
      {children}
      <EngineBottomNav items={bottomNav} />
    </ThemeScope>
  );
}
