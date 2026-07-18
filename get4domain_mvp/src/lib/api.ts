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

  // Notifications (not yet implemented on the backend — calls fail silently until it is)
  getUnreadNotifications: () => apiCall('/notifications/unread'),
  subscribeToPushNotifications: (subscription: PushSubscription) =>
    apiCall('/notifications/subscribe', { method: 'POST', body: JSON.stringify(subscription) }),
};
