'use client';

import { api } from '@/lib/api';
import TeleCrmBoard, { type TeleCrmAdapter } from '@/components/telecrm/TeleCrmBoard';

// Admin data source: website demo-booking enquiries (g4d_leads). Same board,
// call flow, AI summary and Kanban as the vendor TeleCRM — only the source differs.
const adminAdapter: TeleCrmAdapter = {
  listLeads: async () => (await api.adminCrmLeads()).data ?? [],
  getLead: async (id) => (await api.adminCrmLead(id)).data,
  updateLead: async (id, data) => { await api.adminUpdateCrmLead(id, data); },
  logCall: async (id, data) => { await api.adminLogCrmCall(id, data); },
  aiSummary: async (data) => {
    const res = await api.generateAiCallSummary(data);
    return res.data?.summary ?? res.data?.content ?? String(res.data);
  },
};

export default function AdminTeleCrmPage() {
  // Wrap in a light surface so the reused (light-themed) board reads well inside
  // the dark admin chrome.
  return (
    <div className="rounded-2xl bg-slate-50 p-4 sm:p-6">
      <TeleCrmBoard
        adapter={adminAdapter}
        title="TeleCRM — Enquiries"
        subtitle="Call website demo bookings and convert them into vendors."
      />
    </div>
  );
}
