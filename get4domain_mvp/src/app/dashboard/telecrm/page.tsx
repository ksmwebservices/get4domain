'use client';

import { useMemo } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useDashboardConfig } from '@/lib/dashboard-config';
import TeleCrmBoard, { type TeleCrmAdapter, type TeleCrmContactField } from '@/components/telecrm/TeleCrmBoard';

// Vendor data source: the vendor's own campaign leads (g4d_campaign_leads).
const vendorAdapter: TeleCrmAdapter = {
  listLeads: async () => (await api.getCrmLeads()).data ?? [],
  getLead: async (id) => (await api.getCrmLead(id)).data,
  updateLead: async (id, data) => { await api.updateCrmLead(id, data); },
  logCall: async (id, data) => { await api.logCrmCall(id, data); },
  // Vendor CRM extras — add a contact, import a call list, recent calls.
  createLead: async (data) => { await api.createCrmLead(data); },
  importLeads: async (contacts) => (await api.importCrmLeads(contacts)).data,
  recentCalls: async () => (await api.getRecentCalls()).data ?? [],
};

export default function TeleCrmPage() {
  const { user } = useAuth();
  // Config-driven contact fields + noun (reuse the industry recordCustomFields).
  const { industry } = useDashboardConfig(user?.industry);

  const contactFields = useMemo<TeleCrmContactField[]>(
    () => (industry?.recordCustomFields ?? []).map((f) => ({
      key: f.key, label: f.label, type: f.type, options: f.options, required: f.required,
    })),
    [industry],
  );
  const contactNoun = industry?.entities?.contact?.label ?? 'Contact';

  return <TeleCrmBoard adapter={vendorAdapter} contactFields={contactFields} contactNoun={contactNoun} />;
}
