# MR Travels — Content Inventory & Migration Assessment (17 Aug 2026)

Source read for the LEGACY_MIGRATION dispatch. **No MR Travels container, DB, or
DNS was modified** — content was read from (a) the MR Travels repo at
`C:\Get4Domain\CLIENT_PROJECTS\TRAVEL\CLIENTS\MR_TRAVELS_001`, and (b) the **live
public website** `https://mrtravels.get4domain.com` (public pages only, as any
visitor). The MR Travels Supabase DB itself is **unreachable from this machine**
(Supabase tenant IP allow-list blocks this IP — a deliberate security control,
not circumvented).

## 1. Where the real content lives

- **Live DB (owner-configured):** effectively **placeholder/test data only** —
  MR Travels was never launched to real customers (confirmed in the dispatch).
  - Tour packages: **1** — `munnar` slug, title "munnur", Domestic, ₹8,000,
    3D/2N, destination "munnur", overview "munnu test", inclusions "hotel meals",
    exclusions "lunch". Clearly a test row.
  - Fleet: **1** vehicle — "tata starbus", type Bus, 1 seat. Test row.
  - Customers/leads/bookings/invoices: **counts unknown** (DB unreadable), but the
    site was never launched, so these are near-zero/test. **Not customer-facing
    website content** and out of scope for a website migration regardless.
- **Static website content (genuine, in the frontend source + rendered live):**
  rich and worth migrating — this is the real "content".

## 2. Business identity (real — from `frontend/lib/constants.ts` BRAND + live site)

| Field | Value |
|---|---|
| Name | M.R. Travels & Tours |
| Tagline | Your Journey, Our Priority |
| Phone | 99521 09224 (tel 919952109224) |
| Email | mrtravelstours@gmail.com |
| Address | Thirukazhukundram, Chengalpattu District, Tamil Nadu |
| Established | 2010 |
| Hours | 24/7 Available |
| GST | 33ABCDE1234F1Z5 — **looks like a placeholder** (ABCDE1234F pattern); confirm real GSTIN with KSM before showing on invoices |
| Service areas | Tamil Nadu, Chengalpattu, Chennai, Andhra Pradesh, Karnataka, Kerala |
| Logo | `/mainlogo_mrtravel.png` (asset in MR Travels `frontend/public`) |

## 3. Website content blocks (genuine marketing copy)

- **About:** founded 2010 in Thirukazhukundram "with a single bus and a big
  dream"; grew to "12+ modern AC coaches"; mission, vision, 4 values (Safety,
  Punctuality, Customer Care, Quality); milestone timeline 2010 Founded / 2015
  Fleet Expansion (5 AC coaches) / 2020 Corporate Services / 2025 12+ Vehicles.
- **Services (6 categories, each 4 bullets):** Domestic Tour Packages; Corporate
  Employee Transportation; School & College Tours; Vehicle Rental; Airport Pickup
  & Drop; Custom Tour Planning. Plus "10K+ customers", "24/7", verified drivers.
- **19 service types** (from `constants.ts SERVICE_TYPES`): Domestic Tour Package,
  Family Package, Group Tour, Temple Tour, Corporate Tour, School Tour,
  Educational Tour, Corporate Employee Transport, Monthly Bus Contract, School Bus
  Contract, College Bus Contract, Local Cab Booking, Airport Pickup & Drop, Tempo
  Traveller Rental, Mini Bus Rental, Tourist Bus Rental, Vehicle Rental, Driver
  with Vehicle, Custom Tour Planning.
- **Fleet types:** AC Coach, Mini Bus, Tempo Traveller, Sedan Cab, SUV/Innova,
  Tourist Bus.
- **Images:** Pexels **stock** photos (see `constants.ts PEXEL_IMAGES`) — not
  owned photography. Safe to reuse or replace with the theme's own imagery.

## 4. Schema mapping — what maps to Get4Domain, what does NOT

**Maps cleanly (website content → new vendor):**
- Tour package(s) → `VendorProduct` (title, price, description, inclusions/
  exclusions, duration, destination, image). 1 real (test) row + we can seed the
  service catalog as products.
- Business identity + About/Services copy → `VendorCMS` (businessName, tagline,
  about, phone/whatsapp/email/address, banner/logo, themeId).
- Custom look → `g4d_website_themes` (a travel theme).

**Does NOT map (bespoke operational BOS — ~40 tables, a full travel ERP):**
Bookings (7 types), Quotations, Invoices, Payments, Receipts, Fleet
(Vehicles/Drivers/attendance/duty), Trip Sheets, Tariff Engine, Corporate
Contracts, Forex/Visa/Passport/Insurance, Ledger, Expenses, Suppliers, Customer/
Driver/Staff portals. Get4Domain's model is deliberately lightweight (Contact/
CatalogItem/Record/Invoice + optional addons) — "NOT a full ERP" (CLAUDE_MEMORY_V2).

**This is the mismatch to flag (per the dispatch + your instruction):** the new
Get4Domain vendor site is a **marketing website + lightweight DomainApp core**, not
a replacement for MR Travels' operational ERP. Because MR Travels holds only test
data and was never launched, **no real operational data is lost by not migrating
the BOS**. The decision this raises is about **cutover** (see below), not about
lossy data mapping — the actual website content maps fine.

## 5. Open questions for KSM (do not block the parallel build)

1. **GSTIN** — is `33ABCDE1234F1Z5` real or placeholder? Needed before invoices.
2. **Cutover implication** — the new vendor site does NOT provide the operational
   BOS (bookings/fleet/quotations/invoicing/driver+customer portals). If
   `mrtravels.get4domain.com` is later repointed to the new vendor, those admin
   workflows go away unless built as Get4Domain addons. Since it's all test data
   and never launched, that may be perfectly fine — but it's KSM's call.
3. **Vendor login credentials** — the migration creates a real vendor; the login
   email/password are supplied at run time (env), not hardcoded.
