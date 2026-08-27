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

/** One vendor's communication identity (WhatsApp is fully theirs; SMS/email are branding only). */
export interface VendorCommsSettings {
  waEnabled: boolean;
  waPhoneNumberId: string | null;
  waDisplayNumber: string | null;
  waTemplateId: string | null;
  waGreeting: string | null;
  waStatus: 'unverified' | 'pending' | 'verified' | string;
  waVerifiedAt: string | null;
  smsBusinessName: string | null;
  emailFromName: string | null;
  emailReplyTo: string | null;
  /** The vendor's business name — used as the placeholder when no override is set. */
  businessName: string;
}

/** PATCH payload: send only what changed. `null` clears an override. */
export type VendorCommsPatch = Partial<Omit<VendorCommsSettings, 'businessName' | 'waVerifiedAt' | 'waStatus'>>;

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
  getSite: (subdomain: string) => apiCall(`/cms/site/${subdomain}`),

  // Tool utilization analytics (2E / 2F)
  getUsage: (q = '') => apiCall(`/analytics/usage${q}`),
  getAllUsage: (q = '') => apiCall(`/analytics/usage/all${q}`),
  getPlatformAccounting: () => apiCall('/analytics/platform-accounting'),

  // Stationery (2D)
  getStationery: () => apiCall('/stationery'),
  createStationery: (data: any) => apiCall('/stationery', { method: 'POST', body: JSON.stringify(data) }),
  updateStationery: (id: string, data: any) => apiCall(`/stationery/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStationery: (id: string) => apiCall(`/stationery/${id}`, { method: 'DELETE' }),
  // WhatsApp bot knowledge base (Q&A the bot answers from before falling back to AI)
  getKbEntries: () => apiCall('/whatsapp-bot/kb'),
  createKbEntry: (data: { question: string; keywords: string; answer: string; active?: boolean }) =>
    apiCall('/whatsapp-bot/kb', { method: 'POST', body: JSON.stringify(data) }),
  updateKbEntry: (id: string, data: Partial<{ question: string; keywords: string; answer: string; active: boolean }>) =>
    apiCall(`/whatsapp-bot/kb/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteKbEntry: (id: string) => apiCall(`/whatsapp-bot/kb/${id}`, { method: 'DELETE' }),

  // Accounting (2C) — expenses, P&L, GST statement (vendorId-scoped server-side)
  getExpenses: (q = '') => apiCall(`/accounting/expenses${q}`),
  createExpense: (data: any) => apiCall('/accounting/expenses', { method: 'POST', body: JSON.stringify(data) }),
  deleteExpense: (id: string) => apiCall(`/accounting/expenses/${id}`, { method: 'DELETE' }),
  expenseVoucher: (id: string) => apiCall(`/accounting/expenses/${id}/voucher`),
  accountingSummary: (q = '') => apiCall(`/accounting/summary${q}`),
  // Phase 5 — payments ledger + GST filing tracker (Accounts Payments/GST tabs).
  getPaymentRecords: (q = '') => apiCall(`/accounting/payments${q}`),
  createPaymentRecord: (data: any) => apiCall('/accounting/payments', { method: 'POST', body: JSON.stringify(data) }),
  deletePaymentRecord: (id: string) => apiCall(`/accounting/payments/${id}`, { method: 'DELETE' }),
  getGstFilings: () => apiCall('/accounting/gst-filings'),
  upsertGstFiling: (data: any) => apiCall('/accounting/gst-filings', { method: 'POST', body: JSON.stringify(data) }),

  // Phase 2 — domain registration (ResellerClub), mapping + purchase via wallet.
  domainConfig: () => apiCall('/domains/config'),
  domainSearch: (query: string) => apiCall(`/domains/search?query=${encodeURIComponent(query)}`),
  getMyDomains: () => apiCall('/domains/mine'),
  domainRegister: (data: { domain: string; years?: number }) => apiCall('/domains/register', { method: 'POST', body: JSON.stringify(data) }),
  domainConnect: (domain: string) => apiCall('/domains/connect', { method: 'POST', body: JSON.stringify({ domain }) }),
  domainVerify: (domain: string) => apiCall('/domains/verify', { method: 'POST', body: JSON.stringify({ domain }) }),
  // Admin-assist: complete domain steps on a vendor's behalf.
  adminGetDomains: (vendorId: string) => apiCall(`/admin/domains?vendorId=${encodeURIComponent(vendorId)}`),
  adminDomainRegister: (data: { vendorId: string; domain: string; years?: number }) => apiCall('/admin/domains/register', { method: 'POST', body: JSON.stringify(data) }),
  adminDomainVerify: (data: { vendorId: string; domain: string }) => apiCall('/admin/domains/verify', { method: 'POST', body: JSON.stringify(data) }),

  // Phase 1 — Travel Operations (Fleet/Drivers addon-gated; Trips/Visa core).
  getVehicles: () => apiCall('/travel/vehicles'),
  createVehicle: (data: any) => apiCall('/travel/vehicles', { method: 'POST', body: JSON.stringify(data) }),
  updateVehicle: (id: string, data: any) => apiCall(`/travel/vehicles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteVehicle: (id: string) => apiCall(`/travel/vehicles/${id}`, { method: 'DELETE' }),
  getDrivers: () => apiCall('/travel/drivers'),
  createDriver: (data: any) => apiCall('/travel/drivers', { method: 'POST', body: JSON.stringify(data) }),
  updateDriver: (id: string, data: any) => apiCall(`/travel/drivers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDriver: (id: string) => apiCall(`/travel/drivers/${id}`, { method: 'DELETE' }),
  getTrips: () => apiCall('/travel/trips'),
  createTrip: (data: any) => apiCall('/travel/trips', { method: 'POST', body: JSON.stringify(data) }),
  updateTrip: (id: string, data: any) => apiCall(`/travel/trips/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTrip: (id: string) => apiCall(`/travel/trips/${id}`, { method: 'DELETE' }),
  getVisas: () => apiCall('/travel/visa'),
  createVisa: (data: any) => apiCall('/travel/visa', { method: 'POST', body: JSON.stringify(data) }),
  updateVisa: (id: string, data: any) => apiCall(`/travel/visa/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteVisa: (id: string) => apiCall(`/travel/visa/${id}`, { method: 'DELETE' }),
  accountingTravelSummary: () => apiCall('/accounting/travel-summary'),
  // Travel recurring contracts (addon-gated) + monthly billing.
  getContracts: () => apiCall('/travel/contracts'),
  createContract: (data: any) => apiCall('/travel/contracts', { method: 'POST', body: JSON.stringify(data) }),
  updateContract: (id: string, data: any) => apiCall(`/travel/contracts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteContract: (id: string) => apiCall(`/travel/contracts/${id}`, { method: 'DELETE' }),
  generateContractInvoices: () => apiCall('/travel/contracts/generate-invoices', { method: 'POST' }),

  // Phase 2 — Salon operations
  salonSummary: () => apiCall('/salon/summary'),
  getStylists: () => apiCall('/salon/stylists'),
  createStylist: (data: any) => apiCall('/salon/stylists', { method: 'POST', body: JSON.stringify(data) }),
  updateStylist: (id: string, data: any) => apiCall(`/salon/stylists/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteStylist: (id: string) => apiCall(`/salon/stylists/${id}`, { method: 'DELETE' }),
  getChairs: () => apiCall('/salon/chairs'),
  createChair: (data: any) => apiCall('/salon/chairs', { method: 'POST', body: JSON.stringify(data) }),
  updateChair: (id: string, data: any) => apiCall(`/salon/chairs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteChair: (id: string) => apiCall(`/salon/chairs/${id}`, { method: 'DELETE' }),
  getSalonAppointments: () => apiCall('/salon/appointments'),
  createSalonAppointment: (data: any) => apiCall('/salon/appointments', { method: 'POST', body: JSON.stringify(data) }),
  updateSalonAppointment: (id: string, data: any) => apiCall(`/salon/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSalonAppointment: (id: string) => apiCall(`/salon/appointments/${id}`, { method: 'DELETE' }),

  // Phase 2 — Gym operations
  gymSummary: () => apiCall('/gym/summary'),
  getGymClasses: () => apiCall('/gym/classes'),
  createGymClass: (data: any) => apiCall('/gym/classes', { method: 'POST', body: JSON.stringify(data) }),
  updateGymClass: (id: string, data: any) => apiCall(`/gym/classes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteGymClass: (id: string) => apiCall(`/gym/classes/${id}`, { method: 'DELETE' }),
  getMemberships: () => apiCall('/gym/memberships'),
  createMembership: (data: any) => apiCall('/gym/memberships', { method: 'POST', body: JSON.stringify(data) }),
  updateMembership: (id: string, data: any) => apiCall(`/gym/memberships/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteMembership: (id: string) => apiCall(`/gym/memberships/${id}`, { method: 'DELETE' }),

  // Phase 2 — Hotel operations
  hotelSummary: () => apiCall('/hotel/summary'),
  getRooms: () => apiCall('/hotel/rooms'),
  createRoom: (data: any) => apiCall('/hotel/rooms', { method: 'POST', body: JSON.stringify(data) }),
  updateRoom: (id: string, data: any) => apiCall(`/hotel/rooms/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteRoom: (id: string) => apiCall(`/hotel/rooms/${id}`, { method: 'DELETE' }),
  getRoomBookings: () => apiCall('/hotel/bookings'),
  createRoomBooking: (data: any) => apiCall('/hotel/bookings', { method: 'POST', body: JSON.stringify(data) }),
  updateRoomBooking: (id: string, data: any) => apiCall(`/hotel/bookings/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteRoomBooking: (id: string) => apiCall(`/hotel/bookings/${id}`, { method: 'DELETE' }),

  // Phase 2 — Real Estate operations
  realEstateSummary: () => apiCall('/realestate/summary'),
  getListings: () => apiCall('/realestate/listings'),
  createListing: (data: any) => apiCall('/realestate/listings', { method: 'POST', body: JSON.stringify(data) }),
  updateListing: (id: string, data: any) => apiCall(`/realestate/listings/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteListing: (id: string) => apiCall(`/realestate/listings/${id}`, { method: 'DELETE' }),
  getDeals: () => apiCall('/realestate/deals'),
  createDeal: (data: any) => apiCall('/realestate/deals', { method: 'POST', body: JSON.stringify(data) }),
  updateDeal: (id: string, data: any) => apiCall(`/realestate/deals/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDeal: (id: string) => apiCall(`/realestate/deals/${id}`, { method: 'DELETE' }),
  getVisits: () => apiCall('/realestate/visits'),
  createVisit: (data: any) => apiCall('/realestate/visits', { method: 'POST', body: JSON.stringify(data) }),
  updateVisit: (id: string, data: any) => apiCall(`/realestate/visits/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteVisit: (id: string) => apiCall(`/realestate/visits/${id}`, { method: 'DELETE' }),

  // Phase 2 — Education operations
  educationSummary: () => apiCall('/education/summary'),
  getBatches: () => apiCall('/education/batches'),
  createBatch: (data: any) => apiCall('/education/batches', { method: 'POST', body: JSON.stringify(data) }),
  updateBatch: (id: string, data: any) => apiCall(`/education/batches/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBatch: (id: string) => apiCall(`/education/batches/${id}`, { method: 'DELETE' }),
  getEnrollments: () => apiCall('/education/enrollments'),
  createEnrollment: (data: any) => apiCall('/education/enrollments', { method: 'POST', body: JSON.stringify(data) }),
  updateEnrollment: (id: string, data: any) => apiCall(`/education/enrollments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteEnrollment: (id: string) => apiCall(`/education/enrollments/${id}`, { method: 'DELETE' }),

  // Phase 2 — Professional Services operations
  professionalSummary: () => apiCall('/professional/summary'),
  getEngagements: () => apiCall('/professional/engagements'),
  getEngagement: (id: string) => apiCall(`/professional/engagements/${id}`),
  createEngagement: (data: any) => apiCall('/professional/engagements', { method: 'POST', body: JSON.stringify(data) }),
  updateEngagement: (id: string, data: any) => apiCall(`/professional/engagements/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteEngagement: (id: string) => apiCall(`/professional/engagements/${id}`, { method: 'DELETE' }),
  getEngagementDocuments: () => apiCall('/professional/documents'),
  addEngagementDocument: (engagementId: string, data: any) => apiCall(`/professional/engagements/${engagementId}/documents`, { method: 'POST', body: JSON.stringify(data) }),
  updateEngagementDocument: (id: string, data: any) => apiCall(`/professional/documents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteEngagementDocument: (id: string) => apiCall(`/professional/documents/${id}`, { method: 'DELETE' }),

  // Phase 3 — Construction operations
  constructionSummary: () => apiCall('/construction/summary'),
  getProjects: () => apiCall('/construction/projects'),
  getProject: (id: string) => apiCall(`/construction/projects/${id}`),
  createProject: (data: any) => apiCall('/construction/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id: string, data: any) => apiCall(`/construction/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteProject: (id: string) => apiCall(`/construction/projects/${id}`, { method: 'DELETE' }),
  addMilestone: (projectId: string, data: any) => apiCall(`/construction/projects/${projectId}/milestones`, { method: 'POST', body: JSON.stringify(data) }),
  updateMilestone: (id: string, data: any) => apiCall(`/construction/milestones/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteMilestone: (id: string) => apiCall(`/construction/milestones/${id}`, { method: 'DELETE' }),
  getMaterials: () => apiCall('/construction/materials'),
  createMaterial: (data: any) => apiCall('/construction/materials', { method: 'POST', body: JSON.stringify(data) }),
  updateMaterial: (id: string, data: any) => apiCall(`/construction/materials/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteMaterial: (id: string) => apiCall(`/construction/materials/${id}`, { method: 'DELETE' }),

  // Phase 3 — Events operations
  eventsSummary: () => apiCall('/events/summary'),
  getBookings: () => apiCall('/events/bookings'),
  getBooking: (id: string) => apiCall(`/events/bookings/${id}`),
  createBooking: (data: any) => apiCall('/events/bookings', { method: 'POST', body: JSON.stringify(data) }),
  updateBooking: (id: string, data: any) => apiCall(`/events/bookings/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBooking: (id: string) => apiCall(`/events/bookings/${id}`, { method: 'DELETE' }),
  addEventVendor: (bookingId: string, data: any) => apiCall(`/events/bookings/${bookingId}/vendors`, { method: 'POST', body: JSON.stringify(data) }),
  getEventVendors: () => apiCall('/events/vendors'),
  updateEventVendor: (id: string, data: any) => apiCall(`/events/vendors/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteEventVendor: (id: string) => apiCall(`/events/vendors/${id}`, { method: 'DELETE' }),

  // Phase 3 — Finance operations
  financeSummary: () => apiCall('/finance/summary'),
  getCases: () => apiCall('/finance/cases'),
  getCase: (id: string) => apiCall(`/finance/cases/${id}`),
  createCase: (data: any) => apiCall('/finance/cases', { method: 'POST', body: JSON.stringify(data) }),
  updateCase: (id: string, data: any) => apiCall(`/finance/cases/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCase: (id: string) => apiCall(`/finance/cases/${id}`, { method: 'DELETE' }),
  getCaseDocuments: () => apiCall('/finance/documents'),
  addCaseDocument: (caseId: string, data: any) => apiCall(`/finance/cases/${caseId}/documents`, { method: 'POST', body: JSON.stringify(data) }),
  updateCaseDocument: (id: string, data: any) => apiCall(`/finance/documents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCaseDocument: (id: string) => apiCall(`/finance/documents/${id}`, { method: 'DELETE' }),

  // Phase 3 — Automobile operations
  automobileSummary: () => apiCall('/automobile/summary'),
  getJobs: () => apiCall('/automobile/jobs'),
  getJob: (id: string) => apiCall(`/automobile/jobs/${id}`),
  createJob: (data: any) => apiCall('/automobile/jobs', { method: 'POST', body: JSON.stringify(data) }),
  updateJob: (id: string, data: any) => apiCall(`/automobile/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteJob: (id: string) => apiCall(`/automobile/jobs/${id}`, { method: 'DELETE' }),
  addJobLine: (jobId: string, data: any) => apiCall(`/automobile/jobs/${jobId}/lines`, { method: 'POST', body: JSON.stringify(data) }),
  updateJobLine: (id: string, data: any) => apiCall(`/automobile/lines/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteJobLine: (id: string) => apiCall(`/automobile/lines/${id}`, { method: 'DELETE' }),
  getParts: () => apiCall('/automobile/parts'),
  createPart: (data: any) => apiCall('/automobile/parts', { method: 'POST', body: JSON.stringify(data) }),
  updatePart: (id: string, data: any) => apiCall(`/automobile/parts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePart: (id: string) => apiCall(`/automobile/parts/${id}`, { method: 'DELETE' }),

  // Phase 3 — Logistics operations
  logisticsSummary: () => apiCall('/logistics/summary'),
  getShipments: () => apiCall('/logistics/shipments'),
  createShipment: (data: any) => apiCall('/logistics/shipments', { method: 'POST', body: JSON.stringify(data) }),
  updateShipment: (id: string, data: any) => apiCall(`/logistics/shipments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteShipment: (id: string) => apiCall(`/logistics/shipments/${id}`, { method: 'DELETE' }),

  // Phase 3 — Diagnostics operations
  diagnosticsSummary: () => apiCall('/diagnostics/summary'),
  getTestOrders: () => apiCall('/diagnostics/orders'),
  getTestOrder: (id: string) => apiCall(`/diagnostics/orders/${id}`),
  createTestOrder: (data: any) => apiCall('/diagnostics/orders', { method: 'POST', body: JSON.stringify(data) }),
  updateTestOrder: (id: string, data: any) => apiCall(`/diagnostics/orders/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTestOrder: (id: string) => apiCall(`/diagnostics/orders/${id}`, { method: 'DELETE' }),
  addTestOrderItem: (orderId: string, data: any) => apiCall(`/diagnostics/orders/${orderId}/items`, { method: 'POST', body: JSON.stringify(data) }),
  updateTestOrderItem: (id: string, data: any) => apiCall(`/diagnostics/items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTestOrderItem: (id: string) => apiCall(`/diagnostics/items/${id}`, { method: 'DELETE' }),

  // Phase 3 — Photography operations
  photographySummary: () => apiCall('/photography/summary'),
  getShoots: () => apiCall('/photography/shoots'),
  getShoot: (id: string) => apiCall(`/photography/shoots/${id}`),
  createShoot: (data: any) => apiCall('/photography/shoots', { method: 'POST', body: JSON.stringify(data) }),
  updateShoot: (id: string, data: any) => apiCall(`/photography/shoots/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteShoot: (id: string) => apiCall(`/photography/shoots/${id}`, { method: 'DELETE' }),
  addDeliverable: (shootId: string, data: any) => apiCall(`/photography/shoots/${shootId}/deliverables`, { method: 'POST', body: JSON.stringify(data) }),
  getDeliverables: () => apiCall('/photography/deliverables'),
  updateDeliverable: (id: string, data: any) => apiCall(`/photography/deliverables/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDeliverable: (id: string) => apiCall(`/photography/deliverables/${id}`, { method: 'DELETE' }),

  // Phase 3 — Agriculture operations
  agricultureSummary: () => apiCall('/agriculture/summary'),
  getProduceOrders: () => apiCall('/agriculture/orders'),
  createProduceOrder: (data: any) => apiCall('/agriculture/orders', { method: 'POST', body: JSON.stringify(data) }),
  updateProduceOrder: (id: string, data: any) => apiCall(`/agriculture/orders/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteProduceOrder: (id: string) => apiCall(`/agriculture/orders/${id}`, { method: 'DELETE' }),
  getProduceStock: () => apiCall('/agriculture/stock'),
  createProduceStock: (data: any) => apiCall('/agriculture/stock', { method: 'POST', body: JSON.stringify(data) }),
  updateProduceStock: (id: string, data: any) => apiCall(`/agriculture/stock/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteProduceStock: (id: string) => apiCall(`/agriculture/stock/${id}`, { method: 'DELETE' }),

  // Phase 3 — Coaching operations
  coachingSummary: () => apiCall('/coaching/summary'),
  getCoachingBatches: () => apiCall('/coaching/batches'),
  getCoachingBatch: (id: string) => apiCall(`/coaching/batches/${id}`),
  createCoachingBatch: (data: any) => apiCall('/coaching/batches', { method: 'POST', body: JSON.stringify(data) }),
  updateCoachingBatch: (id: string, data: any) => apiCall(`/coaching/batches/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCoachingBatch: (id: string) => apiCall(`/coaching/batches/${id}`, { method: 'DELETE' }),
  addCoachingSession: (batchId: string, data: any) => apiCall(`/coaching/batches/${batchId}/sessions`, { method: 'POST', body: JSON.stringify(data) }),
  updateCoachingSession: (id: string, data: any) => apiCall(`/coaching/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCoachingSession: (id: string) => apiCall(`/coaching/sessions/${id}`, { method: 'DELETE' }),
  getCoachingEnrollments: () => apiCall('/coaching/enrollments'),
  createCoachingEnrollment: (data: any) => apiCall('/coaching/enrollments', { method: 'POST', body: JSON.stringify(data) }),
  updateCoachingEnrollment: (id: string, data: any) => apiCall(`/coaching/enrollments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCoachingEnrollment: (id: string) => apiCall(`/coaching/enrollments/${id}`, { method: 'DELETE' }),

  // Phase 3 — Technology operations
  technologySummary: () => apiCall('/technology/summary'),
  getTechProjects: () => apiCall('/technology/projects'),
  createTechProject: (data: any) => apiCall('/technology/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateTechProject: (id: string, data: any) => apiCall(`/technology/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTechProject: (id: string) => apiCall(`/technology/projects/${id}`, { method: 'DELETE' }),
  getTechTasks: () => apiCall('/technology/tasks'),
  createTechTask: (data: any) => apiCall('/technology/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTechTask: (id: string, data: any) => apiCall(`/technology/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTechTask: (id: string) => apiCall(`/technology/tasks/${id}`, { method: 'DELETE' }),

  // AI template library (2.2)
  aiTemplates: (q = '') => apiCall(`/ai-templates${q}`),
  aiTemplatesAll: () => apiCall('/ai-templates/all'),
  // Resolved per-use AI content costs (paise) — single source of truth for showcase pricing.
  aiCosts: () => apiCall('/ai/costs'),
  // Design editor (Fabric.js) — built-in sample scene templates (no key needed).
  designTemplates: () => apiCall('/design/templates'),
  // Photo reels (Remotion) — licensed music tracks + server-side MP4 render.
  reelTracks: () => apiCall('/reels/tracks'),
  renderReel: (data: { images: string[]; text?: string; trackId?: string; accent?: string }) =>
    apiCall('/reels/render', { method: 'POST', body: JSON.stringify(data) }),
  // Business documents (AI Studio Redesign) — coded templates + invoice-style render.
  businessDocTemplates: () => apiCall('/business-documents/templates'),
  renderBusinessDocument: (data: { type: string; values: Record<string, string>; brand?: { color?: string; logoUrl?: string } }) =>
    apiCall('/business-documents/render', { method: 'POST', body: JSON.stringify(data) }),
  createAiTemplate: (data: any) => apiCall('/ai-templates', { method: 'POST', body: JSON.stringify(data) }),
  updateAiTemplate: (id: string, data: any) => apiCall(`/ai-templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAiTemplate: (id: string) => apiCall(`/ai-templates/${id}`, { method: 'DELETE' }),
  // Website theme system (2.3)
  websiteThemes: (q = '') => apiCall(`/website-themes${q}`),
  websiteThemesAll: () => apiCall('/website-themes/all'),
  createWebsiteTheme: (data: any) => apiCall('/website-themes', { method: 'POST', body: JSON.stringify(data) }),
  updateWebsiteTheme: (id: string, data: any) => apiCall(`/website-themes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWebsiteTheme: (id: string) => apiCall(`/website-themes/${id}`, { method: 'DELETE' }),
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
  // Phase 5/6 — sandbox go-live (Razorpay ₹999/month → convert to a real account)
  demoBuyOrder: () => apiCall('/demo/buy/order', { method: 'POST' }),
  demoBuyConfirm: (data: {
    businessName: string; email: string; password: string; name?: string; phone?: string;
    razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string;
  }) => apiCall('/demo/buy/confirm', { method: 'POST', body: JSON.stringify(data) }),
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
  importCrmLeads: (contacts: Array<{ name: string; phone: string; customFields?: Record<string, unknown> }>) =>
    apiCall('/crm/leads/import', { method: 'POST', body: JSON.stringify({ contacts }) }),
  getRecentCalls: () => apiCall('/crm/telecrm/recent-calls'),
  createCrmLead: (data: { name: string; phone: string; message?: string; source?: string; customFields?: Record<string, unknown> }) =>
    apiCall('/crm/leads', { method: 'POST', body: JSON.stringify(data) }),
  getCrmLead: (id: string) => apiCall(`/crm/leads/${id}`),
  updateCrmLead: (id: string, data: { status?: string; notes?: string; assignedTo?: string; followUpDate?: string }) =>
    apiCall(`/crm/leads/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  logCrmCall: (id: string, data: { duration?: number; outcome?: string; notes?: string; aiSummary?: string; followUpAt?: string }) =>
    apiCall(`/crm/leads/${id}/call`, { method: 'POST', body: JSON.stringify(data) }),
  getTelecrmQueue: () => apiCall('/crm/telecrm/queue'),
  getTelecrmFollowups: () => apiCall('/crm/telecrm/followups'),

  // Team
  inviteTeamMember: (data: { name: string; email?: string; phone?: string; role: string; department?: string; modules: string[] }) =>
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
  generateAiContent: (data: { channel: string; vendorIndustry: string; offerDetails: string; tone?: string; skipImage?: boolean }) =>
    apiCall('/ai/generate-content', { method: 'POST', body: JSON.stringify(data) }),
  generateAiCallSummary: (data: { textNotes: string; leadName: string; callDuration?: number }) =>
    apiCall('/ai/call-summary', { method: 'POST', body: JSON.stringify(data) }),
  generateDesignImage: (prompt: string) =>
    apiCall('/ai/generate-image', { method: 'POST', body: JSON.stringify({ prompt }) }),
  // Image upload (multipart) — stored on the VM disk, returns { data: { url } }.
  uploadImage: async (file: File): Promise<{ data?: { url: string } }> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('g4d_token') : null;
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${API_BASE}/uploads`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Upload failed');
    return data;
  },

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
  getMyIndustryConfig: () => apiCall('/industries/me'), // 3C — skin + per-vendor override merged
  getWidgetKey: () => apiCall('/widget/my-key'), // 3B — embeddable widget key + snippet
  getVendorOverride: (id: string) => apiCall(`/industries/vendor/${id}/override`),
  setVendorOverride: (id: string, data: any) => apiCall(`/industries/vendor/${id}/override`, { method: 'PUT', body: JSON.stringify(data) }),

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
  commSend: (data: { channel: 'whatsapp' | 'email' | 'sms'; to: string; message: string; subject?: string; contactId?: string }) =>
    apiCall('/communication/send', { method: 'POST', body: JSON.stringify(data) }),
  commHistory: (contactId: string, channel: string) =>
    apiCall(`/communication/history?contactId=${encodeURIComponent(contactId)}&channel=${encodeURIComponent(channel)}`),

  // Customer Hub (vendor side)
  customerInvite: (contactId: string) =>
    apiCall('/customer/invite', { method: 'POST', body: JSON.stringify({ contactId }) }),

  // Admin — platform settings (integrations)
  getPlatformSettings: () => apiCall('/platform-settings'),
  setPlatformSetting: (category: string, key: string, value: string) =>
    apiCall(`/platform-settings/${category}/${key}`, { method: 'PUT', body: JSON.stringify({ value }) }),
  testPlatformSetting: (category: string, key: string) =>
    apiCall(`/platform-settings/${category}/${key}/test`, { method: 'POST' }),

  // Communication settings — vendor self-service (own WhatsApp number + SMS/email branding)
  getMyCommsSettings: () => apiCall('/vendor-comms'),
  updateMyCommsSettings: (data: VendorCommsPatch) =>
    apiCall('/vendor-comms', { method: 'PATCH', body: JSON.stringify(data) }),

  // Communication settings — admin override for any vendor (admin-assist)
  adminGetVendorComms: (vendorId: string) => apiCall(`/admin/vendor-comms?vendorId=${vendorId}`),
  adminUpdateVendorComms: (vendorId: string, data: VendorCommsPatch & { waStatus?: string }) =>
    apiCall(`/admin/vendor-comms?vendorId=${vendorId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Admin — per-vendor module/addon state (pass vendorId)
  adminGetVendorModules: (vendorId: string) => apiCall(`/modules/vendor?vendorId=${vendorId}`),
  adminGetVendorAddons: (vendorId: string) => apiCall(`/addons/vendor?vendorId=${vendorId}`),
};
