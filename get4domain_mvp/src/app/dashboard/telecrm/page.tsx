'use client';

import { api } from '@/lib/api';
import TeleCrmBoard, { type TeleCrmAdapter } from '@/components/telecrm/TeleCrmBoard';

// Vendor data source: the vendor's own campaign leads (g4d_campaign_leads).
const vendorAdapter: TeleCrmAdapter = {
  listLeads: async () => (await api.getCrmLeads()).data ?? [],
  getLead: async (id) => (await api.getCrmLead(id)).data,
  updateLead: async (id, data) => { await api.updateCrmLead(id, data); },
  logCall: async (id, data) => { await api.logCrmCall(id, data); },
  aiSummary: async (data) => {
    const res = await api.generateAiCallSummary(data);
    return res.data?.summary ?? res.data?.content ?? String(res.data);
  },
};

export default function TeleCrmPage() {
  return <TeleCrmBoard adapter={vendorAdapter} />;
}
