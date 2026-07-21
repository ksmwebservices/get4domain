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
  getLeads: () => apiCall('/leads'),
  updateLeadStatus: (id: string, status: string) =>
    apiCall(`/leads/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),

  // Notifications
  getNotifications: () => apiCall('/notifications'),
  markNotificationRead: (id: string) =>
    apiCall(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllNotificationsRead: () =>
    apiCall('/notifications/read-all', { method: 'PUT' }),
  subscribeToPush: (data: { fcmToken: string; device: string; userType: 'VENDOR' | 'ADMIN' }) =>
    apiCall('/notifications/subscribe', { method: 'POST', body: JSON.stringify(data) }),

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

  // AI campaign content
  generateAiContent: (data: { channel: string; vendorIndustry: string; offerDetails: string; tone?: string }) =>
    apiCall('/ai/generate-content', { method: 'POST', body: JSON.stringify(data) }),
  generateAiCallSummary: (data: { textNotes: string; leadName: string; callDuration?: number }) =>
    apiCall('/ai/call-summary', { method: 'POST', body: JSON.stringify(data) }),
};
