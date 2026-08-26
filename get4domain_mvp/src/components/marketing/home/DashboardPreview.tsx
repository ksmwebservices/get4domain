'use client';

import { useState } from 'react';
import {
  Calendar, Clock, Check, Plus, Search, Filter, Bell, Star, Users, Wallet,
  ArrowUpRight, ArrowDownRight, MoreHorizontal, ChevronRight, Package, Tag,
  Receipt, Stethoscope, BarChart3, CalendarCheck, CheckSquare, ShoppingBag, type LucideIcon,
} from 'lucide-react';

const DASH_TABS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'bookings', label: 'Bookings', icon: CalendarCheck },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'pos', label: 'POS', icon: ShoppingBag },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'payments', label: 'Payments', icon: Wallet },
];

export default function DashboardPreview() {
  return (
    <section className="relative py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/5 bg-slate-800/60 px-3.5 py-1.5 text-xs font-medium text-primary-300 backdrop-blur-xl">
            <BarChart3 className="h-3.5 w-3.5" /> Your Workplace
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Run your whole business <span className="text-gradient-hero">from one dashboard.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-400">
            Overview, bookings, tasks, POS, clients and payments — the Workplace keeps every part of your operation in one place. Switch tabs to explore.
          </p>
        </div>
        <DashboardWindow />
      </div>
    </section>
  );
}

function DashboardWindow() {
  const [activeTab, setActiveTab] = useState('overview');
  return (
    <div className="overflow-hidden rounded-2xl border border-white/5 bg-slate-800/60 shadow-device backdrop-blur-xl">
      {/* window bar */}
      <div className="flex items-center gap-2 border-b border-white/5 bg-slate-900/50 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-error-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-success-400/80" />
        <div className="ml-3 max-w-xs flex-1"><div className="truncate font-mono text-[10px] text-slate-400">app.get4domain.com/workplace</div></div>
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-500/20"><span className="text-[9px] font-semibold text-primary-300">AR</span></div>
      </div>

      <div className="flex min-h-[420px]">
        {/* sidebar */}
        <div className="hidden w-14 shrink-0 flex-col border-r border-white/5 bg-slate-900/30 py-3 sm:flex lg:w-48">
          <div className="mb-4 hidden px-3 lg:block"><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Menu</div></div>
          {DASH_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`mx-2 flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200 ${isActive ? 'bg-primary-500/15 text-primary-300' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden text-xs font-medium lg:block">{tab.label}</span>
                {isActive && <span className="ml-auto hidden h-4 w-1 rounded-full bg-primary-400 lg:block" />}
              </button>
            );
          })}
          <div className="mt-auto hidden px-2 lg:block">
            <div className="rounded-lg border border-warning-400/20 bg-gradient-to-br from-warning-400/10 to-primary-500/10 p-3">
              <div className="mb-0.5 text-[10px] font-semibold text-warning-300">Upgrade</div>
              <div className="mb-2 text-[9px] text-slate-400">Save 17% yearly</div>
              <div className="rounded bg-warning-400 px-2 py-1 text-center text-[9px] font-semibold text-slate-900">₹9,999/yr</div>
            </div>
          </div>
        </div>

        {/* main content */}
        <div className="flex-1 overflow-hidden p-4 sm:p-5">
          {activeTab === 'overview' && <OverviewPanel />}
          {activeTab === 'bookings' && <BookingsPanel />}
          {activeTab === 'tasks' && <TasksPanel />}
          {activeTab === 'pos' && <POSPanel />}
          {activeTab === 'clients' && <ClientsPanel />}
          {activeTab === 'payments' && <PaymentsPanel />}
        </div>
      </div>

      {/* mobile tab bar */}
      <div className="no-scrollbar flex items-center justify-around overflow-x-auto border-t border-white/5 bg-slate-900/50 px-1 py-1 sm:hidden">
        {DASH_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex min-w-[44px] flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 transition-all ${isActive ? 'text-primary-300' : 'text-slate-500'}`}>
              <Icon className={`h-4 w-4 transition-transform ${isActive ? 'scale-110' : ''}`} />
              <span className="text-[8px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PanelHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div>
        <h3 className="text-base font-semibold text-slate-100">{title}</h3>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>
      {action && <button className="flex items-center gap-1 text-xs font-medium text-primary-300 transition-colors hover:text-primary-200">{action} <ChevronRight className="h-3 w-3" /></button>}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, change, positive }: { icon: LucideIcon; label: string; value: string; change: string; positive: boolean }) {
  return (
    <div className="rounded-xl border border-white/5 bg-slate-800/50 p-3 transition-all hover:border-primary-400/20">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-500/15"><Icon className="h-3.5 w-3.5 text-primary-300" /></div>
        <span className={`flex items-center gap-0.5 text-[10px] font-medium ${positive ? 'text-success-400' : 'text-error-400'}`}>
          {positive ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}{change}
        </span>
      </div>
      <div className="text-lg font-bold text-slate-100">{value}</div>
      <div className="text-[10px] text-slate-400">{label}</div>
    </div>
  );
}

function OverviewPanel() {
  return (
    <div className="animate-fade-in">
      <PanelHeader title="Overview" subtitle="Welcome back, Anjali" action="View reports" />
      <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard icon={Wallet} label="Revenue (this month)" value="₹48,250" change="+12.5%" positive />
        <StatCard icon={Calendar} label="Appointments" value="128" change="+8.2%" positive />
        <StatCard icon={Users} label="Active clients" value="1,243" change="+3.1%" positive />
        <StatCard icon={Star} label="Avg rating" value="4.9" change="-0.1%" positive={false} />
      </div>
      <div className="mb-4 rounded-xl border border-white/5 bg-slate-800/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-200">Revenue trend</span>
          <span className="text-[10px] text-slate-400">Last 7 days</span>
        </div>
        <div className="flex h-20 items-end gap-1.5">
          {[40, 55, 35, 70, 50, 85, 65].map((h, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div className="w-full rounded-t bg-gradient-to-t from-primary-600 to-primary-400 transition-all duration-500 hover:from-warning-500 hover:to-warning-300" style={{ height: `${h}%` }} />
              <span className="text-[8px] text-slate-500">{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-white/5 bg-slate-800/50 p-4">
        <div className="mb-2 text-xs font-semibold text-slate-200">Recent activity</div>
        <div className="space-y-2">
          {[
            { icon: Calendar, text: 'New appointment booked — Ravi Kumar', time: '2 min ago', color: 'text-success-400' },
            { icon: Wallet, text: 'Payment received — ₹1,500 from Sneha P.', time: '15 min ago', color: 'text-warning-400' },
            { icon: Bell, text: 'New lead from website — Mohan J.', time: '1 hr ago', color: 'text-primary-400' },
          ].map((a, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <a.icon className={`h-3.5 w-3.5 shrink-0 ${a.color}`} />
              <span className="flex-1 truncate text-xs text-slate-300">{a.text}</span>
              <span className="shrink-0 text-[10px] text-slate-500">{a.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BookingsPanel() {
  const bookings = [
    { time: '09:00', name: 'Ravi Kumar', service: 'Cardiology', status: 'confirmed', avatar: 'RK', color: 'bg-success-500' },
    { time: '10:30', name: 'Sneha Patel', service: 'General checkup', status: 'waiting', avatar: 'SP', color: 'bg-warning-500' },
    { time: '12:00', name: 'Mohan Joshi', service: 'Dental cleaning', status: 'pending', avatar: 'MJ', color: 'bg-primary-500' },
    { time: '14:30', name: 'Priya Reddy', service: 'Skin consult', status: 'confirmed', avatar: 'PR', color: 'bg-error-500' },
    { time: '16:00', name: 'Arjun Nair', service: 'Follow-up', status: 'pending', avatar: 'AN', color: 'bg-secondary-500' },
  ];
  const statusStyle: Record<string, string> = {
    confirmed: 'bg-success-500/15 text-success-300 border-success-400/20',
    waiting: 'bg-warning-500/15 text-warning-300 border-warning-400/20',
    pending: 'bg-slate-600/30 text-slate-400 border-white/10',
  };
  return (
    <div className="animate-fade-in">
      <PanelHeader title="Bookings" subtitle="5 appointments today" action="Add booking" />
      <div className="mb-3 flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-white/5 bg-slate-800/50 px-3 py-2">
          <Search className="h-3.5 w-3.5 text-slate-500" />
          <input className="flex-1 bg-transparent text-xs text-slate-200 placeholder-slate-500 outline-none" placeholder="Search bookings..." />
        </div>
        <button className="flex items-center gap-1 rounded-lg border border-white/5 bg-slate-800/50 px-3 py-2 text-xs text-slate-300 transition-colors hover:bg-slate-800"><Filter className="h-3.5 w-3.5" /> Filter</button>
      </div>
      <div className="space-y-2">
        {bookings.map((b, i) => (
          <div key={i} className="group flex items-center gap-3 rounded-xl border border-white/5 bg-slate-800/50 p-3 transition-all hover:border-primary-400/20">
            <div className="w-10 shrink-0 text-center"><div className="text-xs font-bold text-slate-100">{b.time}</div><div className="text-[8px] text-slate-500">AM</div></div>
            <div className="h-8 w-px bg-white/5" />
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${b.color}`}>{b.avatar}</div>
            <div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold text-slate-100">{b.name}</div><div className="text-[10px] text-slate-400">{b.service}</div></div>
            <span className={`rounded-full border px-2 py-1 text-[10px] font-medium capitalize ${statusStyle[b.status]}`}>{b.status}</span>
            <MoreHorizontal className="h-4 w-4 text-slate-500 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

function TasksPanel() {
  const tasks = [
    { title: 'Call back lead — Mohan J.', due: 'Today 5 PM', priority: 'high', done: false },
    { title: 'Send invoice to Ravi Kumar', due: 'Today', priority: 'medium', done: false },
    { title: 'Prepare monthly report', due: 'Tomorrow', priority: 'low', done: false },
    { title: 'Update service menu', due: 'Done', priority: 'low', done: true },
  ];
  const prioStyle: Record<string, string> = {
    high: 'bg-error-500/15 text-error-400', medium: 'bg-warning-500/15 text-warning-300', low: 'bg-primary-500/15 text-primary-300',
  };
  return (
    <div className="animate-fade-in">
      <PanelHeader title="Tasks" subtitle="3 pending · 1 completed" action="Add task" />
      <div className="space-y-2">
        {tasks.map((t, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-white/5 bg-slate-800/50 p-3 transition-all hover:border-primary-400/20">
            <button className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${t.done ? 'border-success-500 bg-success-500' : 'border-slate-500 hover:border-primary-400'}`}>{t.done && <Check className="h-3 w-3 text-white" />}</button>
            <div className="min-w-0 flex-1">
              <div className={`text-xs font-medium ${t.done ? 'text-slate-500 line-through' : 'text-slate-100'}`}>{t.title}</div>
              <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400"><Clock className="h-2.5 w-2.5" /> {t.due}</div>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium capitalize ${prioStyle[t.priority]}`}>{t.priority}</span>
          </div>
        ))}
      </div>
      <button className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/10 bg-slate-800/30 py-2.5 text-xs text-slate-300 transition-all hover:border-primary-400/20 hover:bg-slate-800/50"><Plus className="h-3.5 w-3.5" /> Add new task</button>
    </div>
  );
}

function POSPanel() {
  const products = [
    { name: 'Consultation', price: '₹500', cat: 'Service', icon: Stethoscope },
    { name: 'Health checkup', price: '₹1,200', cat: 'Package', icon: Package },
    { name: 'Vitamin D3', price: '₹350', cat: 'Pharmacy', icon: Tag },
    { name: 'Blood test', price: '₹800', cat: 'Lab', icon: Receipt },
  ];
  return (
    <div className="animate-fade-in">
      <PanelHeader title="Point of Sale" subtitle="Ring up sales & generate invoices" action="New sale" />
      <div className="mb-4 grid grid-cols-2 gap-2.5">
        {products.map((p, i) => (
          <div key={i} className="group cursor-pointer rounded-xl border border-white/5 bg-slate-800/50 p-3 transition-all hover:border-primary-400/20">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500/15 transition-transform group-hover:scale-110"><p.icon className="h-4 w-4 text-primary-300" /></div>
            <div className="text-xs font-semibold text-slate-100">{p.name}</div>
            <div className="mb-1 text-[10px] text-slate-400">{p.cat}</div>
            <div className="text-sm font-bold text-primary-300">{p.price}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-white/5 bg-slate-800/50 p-3">
        <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-slate-200">Current sale</span><span className="text-[10px] text-slate-400">3 items</span></div>
        <div className="mb-2 space-y-1.5">
          {[['Consultation × 1', '₹500'], ['Blood test × 1', '₹800'], ['Vitamin D3 × 2', '₹700']].map(([l, v]) => (
            <div key={l} className="flex items-center justify-between text-xs"><span className="text-slate-300">{l}</span><span className="text-slate-100">{v}</span></div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-white/5 pt-2"><span className="text-xs font-semibold text-slate-200">Total</span><span className="text-lg font-bold text-warning-300">₹2,000</span></div>
        <button className="mt-2 w-full rounded-lg bg-primary-600 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-500">Charge ₹2,000</button>
      </div>
    </div>
  );
}

function ClientsPanel() {
  const clients = [
    { name: 'Ravi Kumar', phone: '+91 98765 43210', visits: 12, spent: '₹24,500', avatar: 'RK', color: 'bg-success-500' },
    { name: 'Sneha Patel', phone: '+91 98123 45678', visits: 8, spent: '₹18,200', avatar: 'SP', color: 'bg-warning-500' },
    { name: 'Mohan Joshi', phone: '+91 99876 54321', visits: 5, spent: '₹9,800', avatar: 'MJ', color: 'bg-primary-500' },
    { name: 'Priya Reddy', phone: '+91 98765 12345', visits: 15, spent: '₹32,000', avatar: 'PR', color: 'bg-error-500' },
  ];
  return (
    <div className="animate-fade-in">
      <PanelHeader title="Clients" subtitle="1,243 total clients" action="Add client" />
      <div className="space-y-2">
        {clients.map((c, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-white/5 bg-slate-800/50 p-3 transition-all hover:border-primary-400/20">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${c.color}`}>{c.avatar}</div>
            <div className="min-w-0 flex-1"><div className="text-xs font-semibold text-slate-100">{c.name}</div><div className="text-[10px] text-slate-400">{c.phone}</div></div>
            <div className="shrink-0 text-right"><div className="text-xs font-bold text-success-300">{c.spent}</div><div className="text-[10px] text-slate-400">{c.visits} visits</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentsPanel() {
  const payments = [
    { id: 'INV-1042', client: 'Ravi Kumar', amount: '₹1,500', method: 'UPI', status: 'paid', date: 'Aug 25' },
    { id: 'INV-1041', client: 'Sneha Patel', amount: '₹800', method: 'Card', status: 'paid', date: 'Aug 24' },
    { id: 'INV-1040', client: 'Mohan Joshi', amount: '₹2,000', method: 'UPI', status: 'pending', date: 'Aug 24' },
    { id: 'INV-1039', client: 'Priya Reddy', amount: '₹3,500', method: 'Net banking', status: 'paid', date: 'Aug 23' },
  ];
  const statusStyle: Record<string, string> = { paid: 'bg-success-500/15 text-success-300', pending: 'bg-warning-500/15 text-warning-300' };
  return (
    <div className="animate-fade-in">
      <PanelHeader title="Payments" subtitle="₹48,250 collected this month" action="New invoice" />
      <div className="mb-4 grid grid-cols-3 gap-2.5">
        {[['Collected', '₹48,250', 'text-success-300'], ['Pending', '₹5,200', 'text-warning-300'], ['Invoices', '128', 'text-slate-100']].map(([l, v, c]) => (
          <div key={l} className="rounded-xl border border-white/5 bg-slate-800/50 p-3"><div className="mb-1 text-[10px] text-slate-400">{l}</div><div className={`text-sm font-bold ${c}`}>{v}</div></div>
        ))}
      </div>
      <div className="space-y-2">
        {payments.map((p, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-white/5 bg-slate-800/50 p-3 transition-all hover:border-primary-400/20">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-500/15"><Receipt className="h-3.5 w-3.5 text-primary-300" /></div>
            <div className="min-w-0 flex-1"><div className="text-xs font-semibold text-slate-100">{p.id} · {p.client}</div><div className="text-[10px] text-slate-400">{p.method} · {p.date}</div></div>
            <div className="shrink-0 text-right"><div className="text-xs font-bold text-slate-100">{p.amount}</div><span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${statusStyle[p.status]}`}>{p.status}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}
