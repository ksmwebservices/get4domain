import { checkFieldDefs, FieldType } from '../core/record-core';

/**
 * The starting field set of every pack tab (Wave 2 Part A). DATA, not logic: staff can edit any set later and a second load never overwrites a row that exists. Each tab keeps a small, honest set.
 * Keyed by tab key, with `OWNER:tab` overrides where two packs use the same tab key for different things. A tab with no entry gets the generic set (title, note), so a new tab works at once.
 * Money is minor units (paise) before GST; labels say "before GST". No field is a promise of a timeframe, and no label uses an internal product word.
 */
export interface SeedField { ownerKey: string; tabKey: string; fieldKey: string; label: string; type: FieldType; required: boolean; options: string[]; sortOrder: number; listColumn: boolean; searchable: boolean }

/** [key, label, type, flags (r required, l list column, s searchable), options] */
type Spec = readonly [string, string, FieldType, string?, string[]?];

const NAME: Spec = ['name', 'Name', 'text', 'rls'];
const PHONE: Spec = ['phone', 'Phone', 'phone', 'l'];
const NOTE: Spec = ['note', 'Note', 'longtext'];
const MONEY = (key: string, label: string, flags = 'l'): Spec => [key, `${label} (before GST)`, 'money', flags];
const CUSTOMER: Spec = ['customer_name', 'Customer name', 'text', 'rls'];
const PATIENT: Spec = ['patient_name', 'Patient name', 'text', 'rls'];
const STUDENT: Spec = ['student_name', 'Student name', 'text', 'rls'];
const CUST: Spec = ['customer', 'Customer', 'text', 'ls'];
const CLIENT: Spec = ['client_name', 'Client name', 'text', 'rls'];

export const GENERIC: readonly Spec[] = [['title', 'Title', 'text', 'rls'], NOTE];

export const TAB_FIELDS: Readonly<Record<string, readonly Spec[]>> = {
  // property
  listings: [['title', 'Listing title', 'text', 'rls'], ['kind', 'For', 'select', 'l', ['Sale', 'Rent']], ['locality', 'Locality', 'text', 'ls'], MONEY('price', 'Price'), ['description', 'Description', 'longtext']],
  projects_and_units: [['project', 'Project', 'text', 'rls'], ['unit', 'Unit', 'text', 'ls'], ['area', 'Area in square feet', 'number', 'l'], MONEY('price', 'Price'), ['availability', 'Availability', 'select', 'l', ['Available', 'Booked', 'Sold']]],
  site_visits: [['visitor_name', 'Visitor name', 'text', 'rls'], PHONE, ['listing', 'Listing', 'text', 's'], ['visit_at', 'Visit on', 'datetime', 'l'], ['outcome', 'Outcome', 'longtext']],
  owners_and_tenants: [NAME, PHONE, ['role', 'Role', 'select', 'l', ['Owner', 'Tenant']], ['property', 'Property', 'text', 's'], NOTE],
  rent_roll: [['tenant', 'Tenant', 'text', 'rls'], ['property', 'Property', 'text', 'ls'], MONEY('monthly_rent', 'Monthly rent'), ['due_day', 'Due day of the month', 'number'], ['paid_up_to', 'Paid up to', 'date', 'l']],
  // clinic, lab, pharmacy (these packs stay hidden until the counsel switch is on)
  patients: [PATIENT, PHONE, ['email', 'Email', 'email'], NOTE],
  appointments: [CUSTOMER, PHONE, ['when', 'When', 'datetime', 'l'], ['service', 'Service', 'text', 's'], NOTE],
  visit_notes: [PATIENT, ['date', 'Date', 'date', 'l'], ['notes', 'Notes', 'longtext']],
  prescriptions: [PATIENT, ['date', 'Date', 'date', 'l'], ['notes', 'Notes', 'longtext']],
  'CLINIC:billing': [PATIENT, MONEY('amount', 'Amount'), ['date', 'Date', 'date', 'l'], NOTE],
  'PHARMACY:billing': [CUSTOMER, MONEY('amount', 'Amount'), ['date', 'Date', 'date', 'l'], NOTE],
  follow_ups: [PATIENT, PHONE, ['due', 'Due on', 'date', 'l'], NOTE],
  test_catalogue: [['test_name', 'Test name', 'text', 'rls'], ['code', 'Code', 'text', 's'], ['sample_type', 'Sample type', 'text', 'l'], MONEY('price', 'Price')],
  'LAB:orders': [PATIENT, PHONE, ['date', 'Date', 'date', 'l'], MONEY('amount', 'Amount'), NOTE],
  sample_tracking: [['order_ref', 'Order reference', 'text', 'rls'], PATIENT, ['collected_at', 'Collected on', 'datetime', 'l'], ['sample_status', 'Sample status', 'select', 'l', ['Collected', 'Received', 'Processing', 'Done']]],
  reports: [['title', 'Report title', 'text', 'rls'], ['for_name', 'For', 'text', 'ls'], ['date', 'Date', 'date', 'l'], NOTE],
  stock_with_batches_and_expiry: [['item', 'Item', 'text', 'rls'], ['batch', 'Batch number', 'text', 'ls'], ['quantity', 'Quantity', 'number', 'l'], ['expiry', 'Expiry date', 'date', 'l'], MONEY('price', 'Price')],
  refills: [CUSTOMER, PHONE, ['item', 'Item', 'text', 's'], ['due', 'Due on', 'date', 'l']],
  // retail
  products: [['name', 'Product name', 'text', 'rls'], ['sku', 'SKU', 'text', 'ls'], MONEY('price', 'Price'), ['stock', 'In stock', 'number', 'l'], ['category', 'Category', 'text', 's'], ['description', 'Description', 'longtext']],
  stock: [['item', 'Item', 'text', 'rls'], ['sku', 'SKU', 'text', 'ls'], ['quantity', 'Quantity', 'number', 'l'], ['reorder_level', 'Reorder level', 'number'], ['location', 'Location', 'text']],
  cart_and_orders: [CUSTOMER, PHONE, MONEY('amount', 'Amount'), ['delivery_address', 'Delivery address', 'longtext'], NOTE],
  returns: [['order_ref', 'Order reference', 'text', 'rls'], ['item', 'Item', 'text', 'ls'], ['reason', 'Reason', 'longtext'], MONEY('refund', 'Refund amount')],
  offers: [['title', 'Offer', 'text', 'rls'], ['description', 'Details', 'longtext'], ['starts_on', 'Starts on', 'date', 'l'], ['ends_on', 'Ends on', 'date', 'l']],
  // food service
  menu: [['dish', 'Dish', 'text', 'rls'], ['category', 'Category', 'text', 'ls'], MONEY('price', 'Price'), ['veg', 'Vegetarian', 'bool', 'l'], ['description', 'Description', 'longtext']],
  table_or_online_orders: [CUSTOMER, ['table', 'Table', 'text', 'l'], ['order_type', 'Order type', 'select', 'l', ['Dine in', 'Takeaway', 'Delivery']], MONEY('amount', 'Amount'), NOTE],
  kitchen_status: [['order_ref', 'Order reference', 'text', 'rls'], ['item', 'Item', 'text', 's'], ['kitchen_status', 'Kitchen status', 'select', 'l', ['Received', 'Preparing', 'Ready', 'Served']]],
  delivery: [['order_ref', 'Order reference', 'text', 'rls'], CUST, ['address', 'Address', 'longtext'], PHONE, ['delivery_status', 'Delivery status', 'select', 'l', ['Pending', 'Out for delivery', 'Delivered', 'Failed']]],
  // field service
  jobs: [['title', 'Job', 'text', 'rls'], CUST, PHONE, ['address', 'Address', 'longtext'], ['scheduled_at', 'Scheduled for', 'datetime', 'l'], NOTE],
  technician_dispatch: [['job_ref', 'Job', 'text', 'rls'], ['technician', 'Technician', 'text', 'ls'], PHONE, ['date', 'Date', 'date', 'l'], NOTE],
  quotes: [CUSTOMER, PHONE, ['title', 'Quote for', 'text', 's'], MONEY('amount', 'Amount'), ['valid_until', 'Valid until', 'date', 'l'], NOTE],
  amc_contracts: [CUSTOMER, PHONE, ['starts_on', 'Starts on', 'date', 'l'], ['ends_on', 'Ends on', 'date', 'l'], MONEY('amount', 'Amount'), NOTE],
  service_history: [CUSTOMER, ['item', 'Item or vehicle', 'text', 'ls'], ['date', 'Date', 'date', 'l'], ['work_done', 'Work done', 'longtext'], MONEY('amount', 'Amount')],
  // vehicle service
  job_cards: [['vehicle_number', 'Vehicle number', 'text', 'rls'], CUST, PHONE, ['date_in', 'Date in', 'date', 'l'], ['work_requested', 'Work requested', 'longtext'], MONEY('estimate', 'Estimate')],
  vehicle_records: [['vehicle_number', 'Vehicle number', 'text', 'rls'], ['make_model', 'Make and model', 'text', 'ls'], ['owner', 'Owner', 'text', 'ls'], PHONE, ['next_service', 'Next service on', 'date', 'l']],
  reminders: [CUSTOMER, PHONE, ['due', 'Remind on', 'date', 'l'], ['message', 'Message', 'longtext']],
  parts: [['part_name', 'Part name', 'text', 'rls'], ['part_number', 'Part number', 'text', 'ls'], ['quantity', 'Quantity', 'number', 'l'], MONEY('price', 'Price')],
  // logistics
  shipments: [['reference', 'Reference', 'text', 'rls'], ['sender', 'Sender', 'text', 'ls'], ['receiver', 'Receiver', 'text', 'ls'], ['from_city', 'From', 'text', 'l'], ['to_city', 'To', 'text', 'l'], MONEY('amount', 'Amount'), NOTE],
  trips: [['trip_ref', 'Trip', 'text', 'rls'], ['vehicle', 'Vehicle', 'text', 'ls'], ['driver', 'Driver', 'text', 'ls'], ['from_city', 'From', 'text', 'l'], ['to_city', 'To', 'text', 'l'], ['date', 'Date', 'date', 'l']],
  'LOGISTICS:vehicles': [['registration', 'Registration number', 'text', 'rls'], ['vehicle_type', 'Type', 'text', 'l'], ['capacity_note', 'Capacity', 'text'], ['driver', 'Driver', 'text', 'ls']],
  drivers: [NAME, PHONE, ['licence_number', 'Licence number', 'text', 's'], ['vehicle', 'Vehicle', 'text', 'l']],
  tracking: [['shipment_ref', 'Shipment', 'text', 'rls'], ['location', 'Location', 'text', 'ls'], ['tracking_status', 'Status', 'select', 'l', ['Picked up', 'In transit', 'Out for delivery', 'Delivered']], ['at', 'At', 'datetime', 'l']],
  pod: [['shipment_ref', 'Shipment', 'text', 'rls'], ['receiver', 'Received by', 'text', 'ls'], ['delivered_at', 'Delivered on', 'datetime', 'l'], NOTE],
  // membership and wellness
  members: [NAME, PHONE, ['email', 'Email', 'email'], ['plan', 'Plan', 'text', 'ls'], ['joined_on', 'Joined on', 'date', 'l'], NOTE],
  plans_and_renewals: [['member_name', 'Member name', 'text', 'rls'], ['plan', 'Plan', 'text', 'ls'], ['starts_on', 'Starts on', 'date', 'l'], ['renews_on', 'Renews on', 'date', 'l'], MONEY('amount', 'Amount')],
  attendance: [NAME, ['date', 'Date', 'date', 'l'], ['present', 'Present', 'bool', 'l'], NOTE],
  product_sales: [CUSTOMER, ['product', 'Product', 'text', 's'], MONEY('amount', 'Amount'), ['date', 'Date', 'date', 'l']],
  // education
  courses: [['course', 'Course', 'text', 'rls'], MONEY('fee', 'Fee'), ['schedule_note', 'Schedule', 'text'], ['description', 'Description', 'longtext']],
  batches: [['batch', 'Batch', 'text', 'rls'], ['course', 'Course', 'text', 'ls'], ['starts_on', 'Starts on', 'date', 'l'], ['seats', 'Seats', 'number', 'l'], NOTE],
  admissions: [STUDENT, ['guardian_phone', 'Guardian phone', 'phone', 'l'], ['course', 'Course', 'text', 'ls'], ['date', 'Date', 'date', 'l']],
  'EDUCATION:fees': [STUDENT, MONEY('amount', 'Amount'), ['due', 'Due on', 'date', 'l'], ['paid', 'Paid', 'bool', 'l']],
  results: [STUDENT, ['course', 'Course', 'text', 'ls'], ['marks', 'Marks', 'text', 'l'], ['date', 'Date', 'date']],
  // legal, finance
  clients: [NAME, PHONE, ['email', 'Email', 'email'], NOTE],
  matters_or_files: [['title', 'Matter or file', 'text', 'rls'], CLIENT, ['reference', 'Reference', 'text', 's'], ['opened_on', 'Opened on', 'date', 'l'], NOTE],
  documents: [['title', 'Document', 'text', 'rls'], ['for_name', 'For', 'text', 'ls'], ['date', 'Date', 'date', 'l'], NOTE],
  deadlines: [['title', 'Deadline', 'text', 'rls'], ['matter', 'Matter or file', 'text', 'ls'], ['due', 'Due on', 'date', 'l'], NOTE],
  'PRACTICE_LEGAL_FINANCE:fees': [CLIENT, MONEY('amount', 'Amount'), ['due', 'Due on', 'date', 'l'], ['paid', 'Paid', 'bool', 'l']],
  // agency and consulting
  projects: [['title', 'Project', 'text', 'rls'], ['client', 'Client', 'text', 'ls'], ['starts_on', 'Starts on', 'date', 'l'], ['due', 'Due on', 'date', 'l'], MONEY('budget', 'Budget', ''), NOTE],
  proposals: [['title', 'Proposal', 'text', 'rls'], ['client', 'Client', 'text', 'ls'], MONEY('amount', 'Amount'), ['sent_on', 'Sent on', 'date', 'l'], NOTE],
  retainers: [['client', 'Client', 'text', 'rls'], MONEY('amount', 'Amount per month'), ['starts_on', 'Starts on', 'date', 'l'], NOTE],
  deliverables: [['title', 'Deliverable', 'text', 'rls'], ['project', 'Project', 'text', 'ls'], ['due', 'Due on', 'date', 'l'], NOTE],
  time: [['project', 'Project', 'text', 'rls'], ['person', 'Person', 'text', 'ls'], ['date', 'Date', 'date', 'l'], ['hours', 'Hours', 'number', 'l'], NOTE],
  // hospitality and events
  packages: [['name', 'Package', 'text', 'rls'], MONEY('price', 'Price'), ['capacity', 'Capacity', 'number', 'l'], ['inclusions', 'Inclusions', 'longtext']],
  availability_calendar: [['date', 'Date', 'date', 'rl'], ['resource', 'Room or hall', 'text', 'ls'], ['available', 'Available', 'bool', 'l'], NOTE],
  bookings: [CUSTOMER, PHONE, ['date', 'Date', 'date', 'l'], ['guests', 'Guests', 'number', 'l'], MONEY('amount', 'Amount'), NOTE],
  advance_payments: [CUSTOMER, ['booking_ref', 'Booking', 'text', 's'], MONEY('amount', 'Amount received'), ['received_on', 'Received on', 'date', 'l'], NOTE],
  // rental fleet
  assets_or_vehicles: [['name', 'Name', 'text', 'rls'], ['reference', 'Registration or reference', 'text', 'ls'], ['category', 'Category', 'text', 'l'], MONEY('rate', 'Rate per day'), NOTE],
  availability: [['asset', 'Asset or vehicle', 'text', 'rls'], ['from', 'From', 'date', 'l'], ['to', 'To', 'date', 'l'], NOTE],
  per_day_pricing: [['asset', 'Asset or vehicle', 'text', 'rls'], MONEY('rate', 'Rate per day'), ['from', 'From', 'date', 'l'], ['to', 'To', 'date', 'l'], NOTE],
  deposit: [CUSTOMER, ['asset', 'Asset or vehicle', 'text', 's'], MONEY('amount', 'Deposit'), ['received_on', 'Received on', 'date', 'l'], ['returned', 'Returned', 'bool', 'l']],
  handover_and_return: [CUSTOMER, ['asset', 'Asset or vehicle', 'text', 'ls'], ['handover_at', 'Handed over on', 'datetime', 'l'], ['return_at', 'Returned on', 'datetime', 'l'], ['condition', 'Condition', 'longtext']],
  // B2B dealer
  catalogue: [['item', 'Item', 'text', 'rls'], ['sku', 'SKU', 'text', 'ls'], MONEY('price', 'Price'), ['description', 'Description', 'longtext']],
  quotations: [CUSTOMER, PHONE, MONEY('amount', 'Amount'), ['valid_until', 'Valid until', 'date', 'l'], NOTE],
  bulk_price_tiers: [['item', 'Item', 'text', 'rls'], ['min_quantity', 'From quantity', 'number', 'rl'], MONEY('price', 'Price per unit', 'rl')],
  vehicle_or_equipment_listings: [['title', 'Listing', 'text', 'rls'], ['make', 'Make', 'text', 'ls'], ['year', 'Year', 'number', 'l'], MONEY('price', 'Price'), ['description', 'Description', 'longtext']],
  test_drives: [CUSTOMER, PHONE, ['vehicle', 'Vehicle', 'text', 'ls'], ['when', 'When', 'datetime', 'l'], NOTE],
  // capability tabs
  services: [['title', 'Service', 'text', 'rls'], MONEY('price', 'Price'), ['description', 'Description', 'longtext']],
  memberships: [['member_name', 'Member name', 'text', 'rls'], ['plan', 'Plan', 'text', 'ls'], ['starts_on', 'Starts on', 'date', 'l'], ['renews_on', 'Renews on', 'date', 'l']],
  brokerage: [CLIENT, ['item', 'Property or item', 'text', 'ls'], MONEY('commission', 'Commission'), NOTE],
  rentals: [CUSTOMER, ['item', 'Item', 'text', 'ls'], ['from', 'From', 'date', 'l'], ['to', 'To', 'date', 'l'], MONEY('amount', 'Amount')],
  made_to_order: [CUSTOMER, PHONE, ['item', 'What is being made', 'text', 'ls'], ['due', 'Needed by', 'date', 'l'], MONEY('amount', 'Amount')],
  dispatch: [['job_ref', 'Job', 'text', 'rls'], ['assignee', 'Assigned to', 'text', 'ls'], ['date', 'Date', 'date', 'l'], NOTE],
  pharmacy: [['item', 'Item', 'text', 'rls'], ['quantity', 'Quantity', 'number', 'l'], ['expiry', 'Expiry date', 'date', 'l'], NOTE],
  lab: [['test', 'Test', 'text', 'rls'], ['patient', 'Patient', 'text', 'ls'], ['date', 'Date', 'date', 'l'], NOTE],
  food_service: [['dish', 'Dish', 'text', 'rls'], MONEY('price', 'Price'), ['description', 'Description', 'longtext']],
  vehicle_rental: [['vehicle', 'Vehicle', 'text', 'rls'], CUST, ['from', 'From', 'date', 'l'], ['to', 'To', 'date', 'l'], MONEY('amount', 'Amount')],
  store: [['name', 'Product name', 'text', 'rls'], MONEY('price', 'Price'), ['stock', 'In stock', 'number', 'l']],
  // add-on packs
  online_ordering: [CUSTOMER, ['order_ref', 'Order reference', 'text', 's'], MONEY('amount', 'Amount'), NOTE],
  pharmacy_counter: [['item', 'Item', 'text', 'rls'], ['batch', 'Batch number', 'text', 'ls'], ['quantity', 'Quantity', 'number', 'l'], ['expiry', 'Expiry date', 'date', 'l']],
  home_collection: [PATIENT, PHONE, ['address', 'Address', 'longtext'], ['date', 'Collection date', 'date', 'l']],
};

/** COMMON tabs that already have their own contract (website, billing, accounting, domain, support, plan, migration, social, AI studio, promotion, CRM, TeleCRM, industry). They get no generic record store. */
export const COMMON_WITH_OWN_CONTRACT: ReadonlySet<string> = new Set(['website', 'industry', 'promotion', 'crm', 'telecrm', 'billing', 'accounting', 'social', 'ai_studio', 'domain', 'support', 'plan', 'migration']);

const build = (ownerKey: string, tabKey: string, specs: readonly Spec[]): SeedField[] =>
  specs.map(([fieldKey, label, type, flags = '', options = []], i) => ({
    ownerKey, tabKey, fieldKey, label, type, required: flags.includes('r'), options: [...options], sortOrder: (i + 1) * 10, listColumn: flags.includes('l'), searchable: flags.includes('s'),
  }));

/** The fields of one tab: its own entry (OWNER:tab first, then tab), else the generic set. */
export function fieldsForTab(ownerKey: string, tabKey: string): SeedField[] {
  return build(ownerKey, tabKey, TAB_FIELDS[`${ownerKey}:${tabKey}`] ?? TAB_FIELDS[tabKey] ?? GENERIC);
}

/** Every record tab (a tab that is not a COMMON tab with its own contract) and its starting fields. `tabs` are the seeded tab definitions. */
export function buildFieldSeed(tabs: ReadonlyArray<{ scope: string; ownerKey: string; key: string }>): { fields: SeedField[]; problems: string[] } {
  const fields: SeedField[] = []; const problems: string[] = []; const seen = new Set<string>();
  for (const t of tabs) {
    if (t.scope === 'COMMON' && COMMON_WITH_OWN_CONTRACT.has(t.key)) continue;
    const id = `${t.ownerKey}|${t.key}`;
    if (seen.has(id)) continue; seen.add(id);
    const set = fieldsForTab(t.ownerKey, t.key);
    for (const p of checkFieldDefs(set.map((f) => ({ key: f.fieldKey, label: f.label, type: f.type, options: f.options })))) problems.push(`${id}: ${p}`);
    fields.push(...set);
  }
  return { fields, problems };
}
