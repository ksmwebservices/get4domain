'use client';

import { useEffect } from 'react';
import { notFound, useParams, useRouter } from 'next/navigation';
import { FEATURES, type Feature } from '@/lib/nav.generated';
import { stateFor, useV2 } from '@/dashboard-v2/context';
import HubPage from '@/dashboard-v2/HubPage';
import { ComingSoonCard, UpgradeCard } from '@/dashboard-v2/UpgradeCard';
import { OLD_ADDRESS } from '@/dashboard-v2/screens';
import { labelFor } from '@/lib/nav.generated';

/** The old address of a feature, for a vendor who is NOT on Dashboard v2 but opened a v2 link (shared URL, stale cookie). */
function oldAddress(f: Feature): string {
  const first = f.legacyRoutes?.[0];
  return OLD_ADDRESS[f.id] ?? (first ? (typeof first === 'string' ? first : first.from) : '/dashboard');
}

/**
 * Every Dashboard v2 screen lives at /dashboard/<department>/<screen>. This one route finds the feature in the registry and shows what the
 * vendor's plan allows: the screen (Open), the upgrade card (Locked), or an honest "not available yet" (Coming soon).
 */
export default function V2ScreenPage() {
  const params = useParams<{ dept: string; screen: string }>();
  const router = useRouter();
  const v2 = useV2();
  const feature = FEATURES.find((f) => f.route === `/dashboard/${params.dept}/${params.screen}`);

  useEffect(() => { if (!v2 && feature) router.replace(oldAddress(feature)); }, [v2, feature, router]);

  if (!feature) notFound();
  if (!v2 || v2.loading || !v2.ctx) return <div className="py-16 text-center text-sm text-slate-400">Loading…</div>;

  // A hidden-from-the-menu feature (e.g. Office and stationery, reached from Business profile) still opens when it is built and the plan allows it.
  const state = stateFor({ ...feature, hidden: false }, v2);
  const label = labelFor(feature, v2.ctx.profile);
  if (state === 'HIDDEN') notFound();
  if (state === 'COMING_SOON') return <ComingSoonCard feature={feature} label={label} />;
  if (state === 'LOCKED') return <UpgradeCard feature={feature} label={label} />;
  return <HubPage feature={feature} />;
}
