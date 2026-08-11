const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';

export async function apiCall(
  endpoint: string,
  options: RequestInit = {}
) {
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('g4d_token')
    : null;

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('g4d_token');
      localStorage.removeItem('g4d_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    throw new Error(data.message || 'API error');
  }

  return data;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  // Vendors (admin)
  getVendors: () => apiCall('/vendors'),
  createVendor: (data: any) =>
    apiCall('/vendors', { method: 'POST', body: JSON.stringify(data) }),
  getVendor: (id: string) => apiCall(`/vendors/${id}`),
  updateVendor: (id: string, data: any) =>
    apiCall(`/vendors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  suspendVendor: (id: string) =>
    apiCall(`/vendors/${id}/suspend`, { method: 'POST' }),
  activateVendor: (id: string) =>
    apiCall(`/vendors/${id}/activate`, { method: 'POST' }),

  // Invoices
  getInvoices: () => apiCall('/invoices'),
  createInvoice: (data: any) =>
    apiCall('/invoices', { method: 'POST', body: JSON.stringify(data) }),
  getVendorInvoices: (vendorId: string) =>
    apiCall(`/invoices/vendor/${vendorId}`),
  getInvoice: (id: string) => apiCall(`/invoices/${id}`),
  getInvoicePdf: (id: string) => apiCall(`/invoices/${id}/pdf`),
  emailInvoice: (id: string) => apiCall(`/invoices/${id}/email`, { method: 'POST' }),
  sendPaymentLink: (id: string) =>
    apiCall(`/invoices/${id}/send-payment-link`, { method: 'POST' }),
  markPaid: (id: string) =>
    apiCall(`/invoices/${id}/mark-paid`, { method: 'POST' }),

  // Subscriptions
  createSubscription: (data: any) =>
    apiCall('/subscriptions', { method: 'POST', body: JSON.stringify(data) }),
  getSubscriptions: () => apiCall('/subscriptions'),
  activateSubscription: (id: string) =>
    apiCall(`/subscriptions/${id}/activate`, { method: 'PUT' }),

  // Payments
  createOrder: (data: { amount: number; currency?: string; receipt: string }) =>
    apiCall('/payments/create-order', { method: 'POST', body: JSON.stringify(data) }),
  verifyPayment: (data: {
    invoiceId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) => apiCall('/payments/verify', { method: 'POST', body: JSON.stringify(data) }),

  // CMS
  getPlatformCMS: () => apiCall('/cms/platform'),
  updatePlatformCMS: (data: any) =>
    apiCall('/cms/platform', { method: 'PUT', body: JSON.stringify(data) }),
  getVendorCMS: (vendorId: string) =>
    apiCall(`/cms/vendor/${vendorId}`),
  updateVendorCMS: (vendorId: string, data: any) =>
    apiCall(`/cms/vendor/${vendorId}`, { method: 'PUT', body: JSON.stringify(data) }),
  getVendorProducts: (vendorId: string) =>
    apiCall(`/cms/vendor/${vendorId}/products`),
  addProduct: (vendorId: string, data: any) =>
    apiCall(`/cms/vendor/${vendorId}/products`, { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id: string, data: any) =>
    apiCall(`/cms/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduct: (id: string) =>
    apiCall(`/cms/products/${id}`, { method: 'DELETE' }),

  // AI Assistant
  chat: (data: {
    message: string;
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
    context?: 'marketing' | 'dashboard';
    industry?: string;
    vendorName?: string;
  }) => apiCall('/ai/chat', { method: 'POST', body: JSON.stringify(data) }),

  // Support
  createTicket: (data: any) =>
    apiCall('/support/tickets', { method: 'POST', body: JSON.stringify(data) }),
  getTickets: () => apiCall('/support/tickets'),
  getVendorTickets: (vendorId: string) =>
    apiCall(`/support/tickets/vendor/${vendorId}`),
  replyTicket: (id: string, adminReply: string) =>
    apiCall(`/support/tickets/${id}/reply`, { method: 'PUT', body: JSON.stringify({ adminReply }) }),
  resolveTicket: (id: string) =>
    apiCall(`/support/tickets/${id}/resolve`, { method: 'PUT' }),

  // Leads (demo bookings)
  createLead: (data: any) =>
    apiCall('/leads', { method: 'POST', body: JSON.stringify(data) }),
  // Book-Demo Phase 1 — OTP request + verify (creates a "verified" demo lead)
  requestOtp: (phone: string) =>
    apiCall('/otp/request', { method: 'POST', body: JSON.stringify({ phone }) }),
  verifyDemoLead: (data: { name: string; phone: string; industry: string; code: string }) =>
    apiCall('/leads/demo', { method: 'POST', body: JSON.stringify(data) }),
  // Book-Demo Phase 2 — industry demo website + enquiry (Fast2SMS WhatsApp)
  getDemoSite: (industry: string) => apiCall(`/demo/site/${encodeURIComponent(industry)}`),
  demoEnquiry: (data: { name: string; phone: string; industry: string; message?: string }) =>
    apiCall('/demo/enquiry', { method: 'POST', body: JSON.stringify(data) }),
  getLeads: () => apiCall('/leads'),
  updateLeadStatus: (id: string, status: string) =>
    apiCall(`/leads/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),

  // Notifications
  getNotifications: () => apiCall('/notifications'),
  markNotificationRead: (id: string) =>
    apiCall(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllNotificationsRead: () =>
    apiCall('/notifications/read-all', { method: 'PUT' }),
  subscribeToPush: (data: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    device: string;
    userType: 'VENDOR' | 'ADMIN';
  }) => apiCall('/notifications/subscribe', { method: 'POST', body: JSON.stringify(data) }),

  // Wallet
  getWalletBalance: () => apiCall('/wallet/balance'),
  getWalletTransactions: (page = 1, limit = 20) =>
    apiCall(`/wallet/transactions?page=${page}&limit=${limit}`),
  createWalletTopup: (amount: number) =>
    apiCall('/wallet/topup', { method: 'POST', body: JSON.stringify({ amount }) }),
  verifyWalletTopup: (data: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) =>
    apiCall('/wallet/topup/verify', { method: 'POST', body: JSON.stringify(data) }),

  // Campaign Pages
  generateCampaignPage: (data: { industry: string; businessName: string; offerTitle: string; description: string; phone: string; whatsapp: string }) =>
    apiCall('/campaign-pages/generate', { method: 'POST', body: JSON.stringify(data) }),
  createCampaignPage: (data: any) =>
    apiCall('/campaign-pages', { method: 'POST', body: JSON.stringify(data) }),
  getCampaignPages: () => apiCall('/campaign-pages'),
  getCampaignPage: (id: string) => apiCall(`/campaign-pages/${id}`),
  updateCampaignPage: (id: string, data: any) =>
    apiCall(`/campaign-pages/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCampaignPage: (id: string) =>
    apiCall(`/campaign-pages/${id}`, { method: 'DELETE' }),
  getCampaignPageAnalytics: (id: string) => apiCall(`/campaign-pages/${id}/analytics`),

  // Public /go/:slug campaign pages (no auth)
  getPublicCampaignPage: (slug: string) => apiCall(`/go/${slug}`),
  submitCampaignPageLead: (slug: string, data: { name: string; phone: string; message?: string }) =>
    apiCall(`/go/${slug}/lead`, { method: 'POST', body: JSON.stringify(data) }),
  incrementCampaignPageView: (pageId: string) =>
    apiCall(`/campaign-pages/${pageId}/view`, { method: 'POST' }),

  // Campaigns
  createCampaign: (data: { name: string; description?: string; channels: string[]; content: Record<string, unknown>; startDate?: string; endDate?: string }) =>
    apiCall('/campaigns', { method: 'POST', body: JSON.stringify(data) }),
  getCampaigns: () => apiCall('/campaigns'),
  getCampaign: (id: string) => apiCall(`/campaigns/${id}`),
  approveCampaign: (id: string) =>
    apiCall(`/campaigns/${id}/approve`, { method: 'POST' }),
  getCampaignAnalytics: (id: string) => apiCall(`/campaigns/${id}/analytics`),

  // CRM
  getCrmLeads: (filters?: { status?: string; source?: string; from?: string; to?: string }) => {
    const params = new URLSearchParams(filters as Record<string, string>).toString();
    return apiCall(`/crm/leads${params ? `?${params}` : ''}`);
  },
  createCrmLead: (data: { name: string; phone: string; message?: string; source?: string }) =>
    apiCall('/crm/leads', { method: 'POST', body: JSON.stringify(data) }),
  getCrmLead: (id: string) => apiCall(`/crm/leads/${id}`),
  updateCrmLead: (id: string, data: { status?: string; notes?: string; assignedTo?: string; followUpDate?: string }) =>
    apiCall(`/crm/leads/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  logCrmCall: (id: string, data: { duration?: number; outcome?: string; notes?: string; aiSummary?: string; followUpAt?: string }) =>
    apiCall(`/crm/leads/${id}/call`, { method: 'POST', body: JSON.stringify(data) }),
  getTelecrmQueue: () => apiCall('/crm/telecrm/queue'),
  getTelecrmFollowups: () => apiCall('/crm/telecrm/followups'),

  // Team
  inviteTeamMember: (data: { name: string; email?: string; phone?: string; role: string; modules: string[] }) =>
    apiCall('/team/invite', { method: 'POST', body: JSON.stringify(data) }),
  getTeamMembers: () => apiCall('/team/members'),
  updateTeamMember: (id: string, data: { role?: string; modules?: string[] }) =>
    apiCall(`/team/members/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  removeTeamMember: (id: string) =>
    apiCall(`/team/members/${id}`, { method: 'DELETE' }),
  acceptTeamInvite: (data: { inviteToken: string; password: string }) =>
    apiCall('/team/invite/accept', { method: 'POST', body: JSON.stringify(data) }),
  getTeamActivity: () => apiCall('/team/activity'),

  // Admin TeleCRM (demo-booking leads / g4d_leads)
  adminCrmLeads: () => apiCall('/admin/crm/leads'),
  adminCrmLead: (id: string) => apiCall(`/admin/crm/leads/${id}`),
  adminUpdateCrmLead: (id: string, data: { status?: string; notes?: string; assignedTo?: string; followUpDate?: string }) =>
    apiCall(`/admin/crm/leads/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  adminLogCrmCall: (id: string, data: { duration?: number; outcome?: string; notes?: string; aiSummary?: string; followUpAt?: string }) =>
    apiCall(`/admin/crm/leads/${id}/call`, { method: 'POST', body: JSON.stringify(data) }),

  // Admin Send Quote
  createQuote: (data: {
    vendorId?: string;
    prospectName: string;
    prospectPhone?: string;
    prospectEmail?: string;
    quoteType: 'domainapp_plan' | 'domaincampaign_wallet' | 'custom';
    itemLabel: string;
    amount: number;
    notes?: string;
    channel: 'email' | 'whatsapp' | 'sms';
    message: string;
    subject?: string;
  }) => apiCall('/admin/quotes', { method: 'POST', body: JSON.stringify(data) }),
  getQuotes: () => apiCall('/admin/quotes'),
  updateQuoteStatus: (id: string, status: 'sent' | 'viewed' | 'accepted') =>
    apiCall(`/admin/quotes/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),

  // Admin Team (internal Get4Domain staff — Super Admin manages)
  adminTeamMe: () => apiCall('/admin-team/me'),
  inviteAdminMember: (data: { name: string; email: string; phone?: string; role: 'SUPER_ADMIN' | 'MARKETING' | 'OPERATIONS' }) =>
    apiCall('/admin-team/invite', { method: 'POST', body: JSON.stringify(data) }),
  getAdminMembers: () => apiCall('/admin-team/members'),
  updateAdminMember: (id: string, data: { role?: string; status?: string }) =>
    apiCall(`/admin-team/members/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  removeAdminMember: (id: string) =>
    apiCall(`/admin-team/members/${id}`, { method: 'DELETE' }),
  acceptAdminInvite: (data: { inviteToken: string; password: string }) =>
    apiCall('/admin-team/invite/accept', { method: 'POST', body: JSON.stringify(data) }),

  // AI campaign content
  generateAiContent: (data: { channel: string; vendorIndustry: string; offerDetails: string; tone?: string }) =>
    apiCall('/ai/generate-content', { method: 'POST', body: JSON.stringify(data) }),
  generateAiCallSummary: (data: { textNotes: string; leadName: string; callDuration?: number }) =>
    apiCall('/ai/call-summary', { method: 'POST', body: JSON.stringify(data) }),

  // AI Studio — video/reel (Runway or HeyGen, admin-selectable; async job)
  getVideoProvider: () => apiCall('/video/provider'),
  generateVideo: (data: { prompt?: string; script?: string; imageUrl?: string }) =>
    apiCall('/video/generate', { method: 'POST', body: JSON.stringify(data) }),
  getVideoStatus: (provider: string, jobId: string) =>
    apiCall(`/video/status?provider=${encodeURIComponent(provider)}&jobId=${encodeURIComponent(jobId)}`),

  // ── v2.0 DomainApp platform ──

  // Industry config
  getIndustries: (summary = false) => apiCall(`/industries${summary ? '?summary=true' : ''}`),
  getIndustryConfig: (key: string) => apiCall(`/industries/${key}`),

  // Modules & addons (per-vendor toggle state)
  getModules: () => apiCall('/modules'),
  getVendorModules: () => apiCall('/modules/vendor'),
  getAddons: () => apiCall('/addons'),
  getVendorAddons: () => apiCall('/addons/vendor'),
  // admin-only toggles (target vendor via body)
  setVendorModule: (key: string, vendorId: string, enable: boolean) =>
    apiCall(`/modules/vendor/${key}/${enable ? 'enable' : 'disable'}`, {
      method: 'POST',
      body: JSON.stringify({ vendorId }),
    }),
  setVendorAddon: (key: string, vendorId: string, enable: boolean) =>
    apiCall(`/addons/vendor/${key}/${enable ? 'enable' : 'disable'}`, {
      method: 'POST',
      body: JSON.stringify({ vendorId }),
    }),

  // DomainApp core — contacts
  daGetContacts: (params = '') => apiCall(`/domainapp/contacts${params}`),
  daCreateContact: (data: Record<string, unknown>) =>
    apiCall('/domainapp/contacts', { method: 'POST', body: JSON.stringify(data) }),
  daGetContact: (id: string) => apiCall(`/domainapp/contacts/${id}`),
  daUpdateContact: (id: string, data: Record<string, unknown>) =>
    apiCall(`/domainapp/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  daDeleteContact: (id: string) => apiCall(`/domainapp/contacts/${id}`, { method: 'DELETE' }),

  // DomainApp core — catalog
  daGetCatalog: (params = '') => apiCall(`/domainapp/catalog${params}`),
  daCreateCatalogItem: (data: Record<string, unknown>) =>
    apiCall('/domainapp/catalog', { method: 'POST', body: JSON.stringify(data) }),
  daGetCatalogItem: (id: string) => apiCall(`/domainapp/catalog/${id}`),
  daUpdateCatalogItem: (id: string, data: Record<string, unknown>) =>
    apiCall(`/domainapp/catalog/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  daDeleteCatalogItem: (id: string) => apiCall(`/domainapp/catalog/${id}`, { method: 'DELETE' }),

  // DomainApp core — records
  daGetRecords: (params = '') => apiCall(`/domainapp/records${params}`),
  daCreateRecord: (data: Record<string, unknown>) =>
    apiCall('/domainapp/records', { method: 'POST', body: JSON.stringify(data) }),
  daGetRecord: (id: string) => apiCall(`/domainapp/records/${id}`),
  daUpdateRecord: (id: string, data: Record<string, unknown>) =>
    apiCall(`/domainapp/records/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  daUpdateRecordStatus: (id: string, status: string) =>
    apiCall(`/domainapp/records/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  daDeleteRecord: (id: string) => apiCall(`/domainapp/records/${id}`, { method: 'DELETE' }),

  // DomainApp core — invoices
  daGetInvoices: (params = '') => apiCall(`/domainapp/invoices${params}`),
  daCreateInvoice: (data: Record<string, unknown>) =>
    apiCall('/domainapp/invoices', { method: 'POST', body: JSON.stringify(data) }),
  daGetInvoice: (id: string) => apiCall(`/domainapp/invoices/${id}`),
  daInvoicePdfUrl: (id: string) =>
    `${API_BASE}/domainapp/invoices/${id}/pdf`,
  daSendInvoiceLink: (id: string) =>
    apiCall(`/domainapp/invoices/${id}/send-link`, { method: 'POST' }),
  daMarkInvoicePaid: (id: string) =>
    apiCall(`/domainapp/invoices/${id}/mark-paid`, { method: 'PUT' }),

  // DomainApp dashboard summary
  daGetSummary: () => apiCall('/domainapp/summary'),

  // Growth Hub (mock Meta/Ads layer)
  growthPublish: (data: { platform: 'facebook' | 'instagram'; content: string; imageUrl?: string }) =>
    apiCall('/growth-hub/publish', { method: 'POST', body: JSON.stringify(data) }),
  growthRequestAd: (data: { name?: string; objective: string; budget: number; durationDays: number; audience: string; channel?: 'meta_ads' | 'google_ads' }) =>
    apiCall('/growth-hub/ads', { method: 'POST', body: JSON.stringify(data) }),
  growthListAds: () => apiCall('/growth-hub/ads'),
  growthLaunchAd: (id: string) => apiCall(`/growth-hub/ads/${id}/launch`, { method: 'POST' }),

  // Communication Hub
  commThreads: () => apiCall('/communication/threads'),
  commSend: (data: { channel: 'whatsapp' | 'email' | 'sms'; to: string; message: string; subject?: string }) =>
    apiCall('/communication/send', { method: 'POST', body: JSON.stringify(data) }),

  // Customer Hub (vendor side)
  customerInvite: (contactId: string) =>
    apiCall('/customer/invite', { method: 'POST', body: JSON.stringify({ contactId }) }),

  // Admin — platform settings (integrations)
  getPlatformSettings: () => apiCall('/platform-settings'),
  setPlatformSetting: (category: string, key: string, value: string) =>
    apiCall(`/platform-settings/${category}/${key}`, { method: 'PUT', body: JSON.stringify({ value }) }),
  testPlatformSetting: (category: string, key: string) =>
    apiCall(`/platform-settings/${category}/${key}/test`, { method: 'POST' }),

  // Admin — per-vendor module/addon state (pass vendorId)
  adminGetVendorModules: (vendorId: string) => apiCall(`/modules/vendor?vendorId=${vendorId}`),
  adminGetVendorAddons: (vendorId: string) => apiCall(`/addons/vendor?vendorId=${vendorId}`),
};
