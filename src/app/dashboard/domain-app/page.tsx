import Link from 'next/link';
import { Globe, ExternalLink, CheckCircle2, ArrowRight, Settings, BarChart3, Users, FileText, Package } from 'lucide-react';
import Button from '@/components/ui/Button';

const modules = [
  { icon: Globe, name: 'Business Website', status: 'active', desc: 'Your public website at mrtravels.get4domain.com', link: 'https://mrtravels.get4domain.com' },
  { icon: Users, name: 'Fleet & Tour CRM', status: 'active', desc: 'Manage bookings, quotations and customer records', link: 'https://mrtravels.get4domain.com/login' },
  { icon: FileText, name: 'GST Invoicing', status: 'active', desc: 'Generate GST-compliant invoices and receipts', link: 'https://mrtravels.get4domain.com/login' },
  { icon: BarChart3, name: 'Trip Sheets & Reports', status: 'active', desc: 'Driver duty sheets, P&L reports and analytics', link: 'https://mrtravels.get4domain.com/login' },
  { icon: Package, name: 'Inventory & Fleet', status: 'active', desc: 'Manage vehicles, drivers and fleet operations', link: 'https://mrtravels.get4domain.com/login' },
];

export default function DomainAppDashboardPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">My DomainApp</h2>
          <p className="mt-1 text-sm text-slate-500">Enterprise plan · Active · Renews 15 Jan 2027</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-success-50 px-3 py-1.5 text-sm font-semibold text-success-700">
          <span className="h-2 w-2 rounded-full bg-success-500 animate-pulse" />
          Live
        </span>
      </div>

      {/* Website quick access */}
      <div className="rounded-2xl border-2 border-primary-200 bg-primary-50/30 p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-slate-900">Your Business Website</h3>
          <a href="https://mrtravels.get4domain.com" target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" leftIcon={<ExternalLink className="h-3.5 w-3.5" />}>Visit Site</Button>
          </a>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2.5">
          <Globe className="h-4 w-4 text-primary-600 flex-shrink-0" />
          <span className="text-sm font-medium text-slate-700">mrtravels.get4domain.com</span>
          <span className="ml-auto text-xs text-success-600 font-semibold">● Live</span>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          To request content changes on your website, raise a <Link href="/dashboard/support" className="text-primary-600 hover:underline font-semibold">support ticket</Link>.
        </p>
      </div>

      {/* Active modules */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-bold text-slate-900 mb-4">Active Modules</h3>
        <div className="space-y-3">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <div key={mod.name} className="flex items-center gap-4 rounded-xl bg-slate-50 p-4 group">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-100">
                  <Icon className="h-5 w-5 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900">{mod.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{mod.desc}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-xs font-semibold text-success-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />Active
                  </span>
                  <a href={mod.link} target="_blank" rel="noopener noreferrer" className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-primary-600 transition-colors">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Useful links */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/dashboard/support" className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 hover:border-primary-200 hover:shadow-sm transition-all group">
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-primary-600" />
            <span className="text-sm font-semibold text-slate-900">Request Changes</span>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-primary-600 transition-colors" />
        </Link>
        <Link href="/dashboard/billing" className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 hover:border-primary-200 hover:shadow-sm transition-all group">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-primary-600" />
            <span className="text-sm font-semibold text-slate-900">View Billing</span>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-primary-600 transition-colors" />
        </Link>
      </div>
    </div>
  );
}
