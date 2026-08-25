// Homepage showcase data: per-industry SIMULATED vendor + client dashboards.
// This is sample/marketing data only — no real vendor/customer data, no backend.
// Each industry has genuinely different record types, names, figures and cards
// (not the same numbers reskinned) so the simulated dashboards feel real.

export type Tone = 'blue' | 'gold' | 'green' | 'red' | 'slate';

export interface DashRow { primary: string; secondary: string; status: string; tone: Tone }
export interface Stat { label: string; value: string }
export interface Highlight { kind: 'ai' | 'campaign' | 'stock'; title: string; subtitle: string }

export interface VendorDash {
  brand: string;              // the sample business name
  revenue: string;
  revenueLabel: string;
  stats: Stat[];              // 3 headline stats
  recordsTitle: string;
  records: DashRow[];         // 4 industry-specific records
  highlight: Highlight;       // AI creative / campaign / stock alert
}

export interface ClientDash {
  brand: string;
  greeting: string;
  title: string;
  items: DashRow[];           // what the customer sees (2)
  invoice: { label: string; amount: string; status: string; tone: Tone };
  cta: string;
}

export interface ShowcaseCategory {
  key: string;
  label: string;
  icon: string;
  tagline: string;
  vendor: VendorDash;
  client: ClientDash;
}

export const SHOWCASE: ShowcaseCategory[] = [
  {
    key: 'clinic', label: 'Clinic', icon: '🏥',
    tagline: 'Appointments, patients, billing & reminders — one place.',
    vendor: {
      brand: 'City Care Clinic', revenue: '₹68,400', revenueLabel: 'This week',
      stats: [{ label: 'Appointments', value: '24' }, { label: 'New Patients', value: '8' }, { label: 'Follow-ups', value: '5' }],
      recordsTitle: "Today's Appointments",
      records: [
        { primary: 'Priya Sharma', secondary: '10:30 AM · Dr. Mehta', status: 'Confirmed', tone: 'green' },
        { primary: 'Rahul Verma', secondary: '11:15 AM · Root Canal', status: 'Confirmed', tone: 'green' },
        { primary: 'Anita Desai', secondary: '12:00 PM · Consultation', status: 'Waiting', tone: 'gold' },
        { primary: 'Imran Khan', secondary: '03:30 PM · Follow-up', status: 'Confirmed', tone: 'green' },
      ],
      highlight: { kind: 'ai', title: 'AI poster ready', subtitle: 'World Health Day · 20% off check-ups' },
    },
    client: {
      brand: 'City Care Clinic', greeting: 'Hi Priya', title: 'Your Appointments',
      items: [
        { primary: 'Dental Check-up', secondary: 'Tomorrow, 10:30 AM', status: 'Confirmed', tone: 'green' },
        { primary: 'Teeth Cleaning', secondary: '12 Sep, 4:00 PM', status: 'Requested', tone: 'gold' },
      ],
      invoice: { label: 'Invoice #INV-204', amount: '₹1,200', status: 'Paid', tone: 'green' },
      cta: 'Book another visit',
    },
  },
  {
    key: 'restaurant', label: 'Restaurant', icon: '🍽️',
    tagline: 'Orders, tables, menu & delivery — live on one screen.',
    vendor: {
      brand: 'Spice Garden', revenue: '₹42,750', revenueLabel: 'Today',
      stats: [{ label: 'Orders', value: '63' }, { label: 'Tables Booked', value: '14' }, { label: 'Avg Order', value: '₹680' }],
      recordsTitle: 'Live Orders',
      records: [
        { primary: '#1042 · Table 6', secondary: 'Butter Chicken +3', status: 'Preparing', tone: 'gold' },
        { primary: '#1043 · Swiggy', secondary: 'Biryani Combo', status: 'Out for delivery', tone: 'blue' },
        { primary: '#1044 · Table 2', secondary: 'Paneer Tikka +2', status: 'Served', tone: 'green' },
        { primary: '#1045 · Takeaway', secondary: 'Family Combo', status: 'New', tone: 'red' },
      ],
      highlight: { kind: 'campaign', title: 'Diwali Feast campaign', subtitle: '1,240 reached · 38 table bookings' },
    },
    client: {
      brand: 'Spice Garden', greeting: 'Hi Arjun', title: 'Your Orders',
      items: [
        { primary: 'Order #1043', secondary: 'Biryani Combo', status: 'Out for delivery', tone: 'blue' },
        { primary: 'Table for 4', secondary: 'Tonight, 8:30 PM', status: 'Confirmed', tone: 'green' },
      ],
      invoice: { label: 'Bill #B-889', amount: '₹1,360', status: 'Paid', tone: 'green' },
      cta: 'Order again',
    },
  },
  {
    key: 'salon', label: 'Salon', icon: '💇',
    tagline: 'Bookings, stylists, packages & reminders — sorted.',
    vendor: {
      brand: 'Glamour Studio', revenue: '₹31,200', revenueLabel: 'Today',
      stats: [{ label: 'Appointments', value: '19' }, { label: 'Walk-ins', value: '6' }, { label: 'Rebookings', value: '4' }],
      recordsTitle: "Today's Chair Schedule",
      records: [
        { primary: 'Sneha Rao', secondary: '11:00 AM · Hair Spa', status: 'Confirmed', tone: 'green' },
        { primary: 'Divya Nair', secondary: '12:30 PM · Bridal Trial', status: 'Confirmed', tone: 'green' },
        { primary: 'Karan Shah', secondary: '02:00 PM · Beard + Cut', status: 'Waiting', tone: 'gold' },
        { primary: 'Meera Iyer', secondary: '04:00 PM · Nail Art', status: 'Confirmed', tone: 'green' },
      ],
      highlight: { kind: 'ai', title: 'AI reel ready', subtitle: 'Monsoon hair-care tips · 12s reel' },
    },
    client: {
      brand: 'Glamour Studio', greeting: 'Hi Sneha', title: 'Your Bookings',
      items: [
        { primary: 'Hair Spa', secondary: 'Today, 11:00 AM', status: 'Confirmed', tone: 'green' },
        { primary: 'Bridal Package', secondary: '20 Sep', status: 'Requested', tone: 'gold' },
      ],
      invoice: { label: 'Invoice #INV-77', amount: '₹2,400', status: 'Paid', tone: 'green' },
      cta: 'Book again',
    },
  },
  {
    key: 'retail', label: 'Retail', icon: '🛒',
    tagline: 'Catalogue, orders, stock & invoices — all connected.',
    vendor: {
      brand: 'Trendy Threads', revenue: '₹1,24,600', revenueLabel: 'This week',
      stats: [{ label: 'Orders', value: '156' }, { label: 'Products', value: '340' }, { label: 'Low Stock', value: '4' }],
      recordsTitle: 'Recent Orders',
      records: [
        { primary: '#ORD-556', secondary: 'Cotton Kurti Set', status: 'Packed', tone: 'blue' },
        { primary: '#ORD-557', secondary: 'Bluetooth Earbuds', status: 'Shipped', tone: 'green' },
        { primary: '#ORD-558', secondary: 'LED Desk Lamp', status: 'New', tone: 'red' },
        { primary: '#ORD-559', secondary: 'Steel Bottle × 3', status: 'Delivered', tone: 'green' },
      ],
      highlight: { kind: 'stock', title: 'Low-stock alert', subtitle: 'Bluetooth Earbuds · 3 left · Reorder' },
    },
    client: {
      brand: 'Trendy Threads', greeting: 'Hi Neha', title: 'Your Orders',
      items: [
        { primary: '#ORD-557', secondary: 'Bluetooth Earbuds', status: 'Shipped', tone: 'green' },
        { primary: '#ORD-560', secondary: 'Party Wear Gown', status: 'Processing', tone: 'gold' },
      ],
      invoice: { label: 'Invoice #INV-891', amount: '₹1,499', status: 'Paid', tone: 'green' },
      cta: 'Shop again',
    },
  },
  {
    key: 'travel', label: 'Travel', icon: '🚗',
    tagline: 'Packages, bookings, fleet & trip sheets — managed.',
    vendor: {
      brand: 'Wanderlust Tours', revenue: '₹2,18,000', revenueLabel: 'This month',
      stats: [{ label: 'Bookings', value: '42' }, { label: 'Enquiries', value: '18' }, { label: 'Fleet', value: '12' }],
      recordsTitle: 'Upcoming Trips',
      records: [
        { primary: 'Kerala Backwaters', secondary: '4N/5D · 12 Sep', status: 'Confirmed', tone: 'green' },
        { primary: 'Goa Beach Holiday', secondary: '3N/4D · 15 Sep', status: 'Advance paid', tone: 'gold' },
        { primary: 'Airport Transfer', secondary: 'Innova · Tomorrow 6 AM', status: 'Driver assigned', tone: 'blue' },
        { primary: 'Golden Triangle', secondary: '5N/6D · Delhi–Agra–Jaipur', status: 'Enquiry', tone: 'red' },
      ],
      highlight: { kind: 'campaign', title: 'Monsoon Getaway campaign', subtitle: '3,100 reached · 24 enquiries' },
    },
    client: {
      brand: 'Wanderlust Tours', greeting: 'Hi Arjun', title: 'Your Trips',
      items: [
        { primary: 'Kerala Backwaters', secondary: '12 Sep · 4N/5D', status: 'Confirmed', tone: 'green' },
        { primary: 'Airport Pickup', secondary: 'Tomorrow, 6:00 AM', status: 'Driver assigned', tone: 'blue' },
      ],
      invoice: { label: 'Invoice #INV-330', amount: '₹18,500', status: 'Advance ₹5,000', tone: 'gold' },
      cta: 'Plan another trip',
    },
  },
  {
    key: 'professional', label: 'Pro Services', icon: '💼',
    tagline: 'Clients, filings, documents & billing — on track.',
    vendor: {
      brand: 'Sharma & Associates', revenue: '₹3,40,000', revenueLabel: 'This month',
      stats: [{ label: 'Active Clients', value: '68' }, { label: 'Filings Due', value: '9' }, { label: 'Consults', value: '14' }],
      recordsTitle: 'Pending Tasks',
      records: [
        { primary: 'GST Return', secondary: 'Ravi Enterprises · Due 20 Sep', status: 'In progress', tone: 'gold' },
        { primary: 'ITR Filing', secondary: 'Meena Nair · Due 25 Sep', status: 'New', tone: 'red' },
        { primary: 'Company Reg.', secondary: 'TechNova Pvt Ltd', status: 'Docs received', tone: 'blue' },
        { primary: 'Trademark', secondary: 'Bright Foods', status: 'Filed', tone: 'green' },
      ],
      highlight: { kind: 'campaign', title: 'Tax-season campaign', subtitle: '820 reached · 11 consults booked' },
    },
    client: {
      brand: 'Sharma & Associates', greeting: 'Hi Ravi', title: 'Your Services',
      items: [
        { primary: 'GST Return (Aug)', secondary: 'Due 20 Sep', status: 'In progress', tone: 'gold' },
        { primary: 'Company Registration', secondary: 'Docs submitted', status: 'Processing', tone: 'blue' },
      ],
      invoice: { label: 'Invoice #INV-512', amount: '₹6,999', status: 'Due', tone: 'red' },
      cta: 'Request a service',
    },
  },
];
