import { Bell, CheckCircle2, Info, AlertCircle } from 'lucide-react';

const notifications = [
  { id: 'n1', type: 'success', message: 'Your website is live at mrtravels.get4domain.com', detail: 'DomainApp Enterprise is active. Your fleet management system is ready to use.', time: '2 days ago' },
  { id: 'n2', type: 'success', message: 'Invoice INV-001 paid successfully — ₹29,499', detail: 'Thank you for your payment. Your GST invoice has been sent to info@mrtravels.com.', time: '15 Jan 2026' },
  { id: 'n3', type: 'info', message: 'Welcome to Get4Domain! Your dashboard is ready.', detail: 'Your vendor dashboard is set up. You can manage your website, view invoices and raise support tickets here.', time: '15 Jan 2026' },
  { id: 'n4', type: 'warning', message: 'Invoice INV-002 pending — ₹35,399 due 25 Jan 2026', detail: 'Please pay before the due date to activate DomainCampaign Business.', time: '18 Jan 2026' },
];

const iconMap = {
  success: { icon: CheckCircle2, color: 'text-success-600', bg: 'bg-success-50' },
  info: { icon: Info, color: 'text-primary-600', bg: 'bg-primary-50' },
  warning: { icon: AlertCircle, color: 'text-warning-600', bg: 'bg-warning-50' },
};

export default function NotificationsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Notifications</h2>
          <p className="mt-1 text-sm text-slate-500">Account updates and important alerts.</p>
        </div>
        <span className="rounded-full bg-primary-100 px-3 py-1 text-sm font-semibold text-primary-700">{notifications.length} total</span>
      </div>

      <div className="space-y-3">
        {notifications.map((n) => {
          const meta = iconMap[n.type as keyof typeof iconMap];
          const Icon = meta.icon;
          return (
            <div key={n.id} className="rounded-2xl border border-slate-200 bg-white p-5 flex gap-4">
              <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${meta.bg}`}>
                <Icon className={`h-5 w-5 ${meta.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-900">{n.message}</div>
                <div className="mt-1 text-xs text-slate-500 leading-relaxed">{n.detail}</div>
                <div className="mt-2 text-xs text-slate-400">{n.time}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
