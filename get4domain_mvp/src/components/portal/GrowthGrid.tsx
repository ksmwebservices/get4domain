import { BarChart3, FileText, Globe, Image as ImageIcon, Inbox, List, Mail, MapPin, Megaphone, MessageCircle, PenLine, Plus, Presentation, Receipt, Search, Share2, Store, Tag, Users, Video, Wrench, type LucideIcon } from 'lucide-react';
import { GROWTH_STATUS_LABEL, type GrowthIcon, type GrowthService, type GrowthStatus } from '@/lib/v3-public/growth-config';
import { GROWTH } from '@/lib/v3-public/growth-strings';
import { CARD } from '@/components/portal/ui';

const ICONS: Record<GrowthIcon, LucideIcon> = {
  globe: Globe, wrench: Wrench, search: Search, pin: MapPin, chart: BarChart3, tag: Tag, store: Store, video: Video, pen: PenLine, file: FileText, mail: Mail, chat: MessageCircle, inbox: Inbox, receipt: Receipt, users: Users, share: Share2, list: List, megaphone: Megaphone, image: ImageIcon, presentation: Presentation, plus: Plus,
};

/** A status label as a chip. The text always says it in words, so colour is never the only signal. */
export function StatusChip({ status }: { status: GrowthStatus }) {
  const tone = status === 'addon' ? 'bg-slate-100 text-slate-800' : status === 'pro' ? 'bg-brand-50 text-brand-800' : 'bg-success-50 text-success-800';
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{GROWTH_STATUS_LABEL[status]}</span>;
}

/** The service cards: icon, name, one honest sentence, the status labels, and the plan note. Used by the home section and the growth page. */
export default function GrowthGrid({ services, withSummary = true }: { services: readonly GrowthService[]; withSummary?: boolean }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((s) => {
        const Icon = ICONS[s.icon];
        return (
          <li key={s.key} className={`${CARD} flex flex-col p-5`}>
            <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-5 w-5" /></span>
            <h3 className="mt-3 text-base font-bold text-ink-900">{s.name}</h3>
            {withSummary ? <p className="mt-1 flex-1 text-sm text-slate-700">{s.summary}</p> : <span className="flex-1" />}
            {s.note ? <p className="mt-2 text-xs font-semibold text-slate-700">{s.note}</p> : null}
            {s.plans === 'ecommerce' ? <p className="mt-2 text-xs font-semibold text-slate-700">{GROWTH.ecommerceOnly}</p> : null}
            {s.statuses.length > 0 ? <p className="mt-3 flex flex-wrap gap-1.5">{s.statuses.map((k) => <StatusChip key={k} status={k} />)}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}
