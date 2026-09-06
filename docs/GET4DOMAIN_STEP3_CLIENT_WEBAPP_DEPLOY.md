# STEP 3 — Client WebApp (Phase C) — Deploy & Verify Note

**Date:** 07 Sep 2026 · **Branch:** `get4domain-site` · **PRD:** §6, §32, §39
**Depends on:** nothing in STEP 1's migration — this slice needs only a normal backend + frontend rebuild.

## What shipped
The read-only customer portal (`/customer`) gains its first **in-app operation**, reusing the
engine Action Registry (per the STEP 3 brief "Reuse Action Registry + Operation Registry"):

- **Backend**
  - `EngineService.dispatchAsCustomer(vendorId, contactId, intent, input)` — a third dispatch
    surface next to authenticated/public. **Public actions only** (a customer can trigger exactly
    what an anonymous site visitor could). vendorId + contactId come from the customer's own
    session token, never the client.
  - `POST /customer/actions/:intent` (customer-token scheme) → `CustomerService.dispatchAction`.
  - `CustomerModule` now imports `EngineModule` (no cycle — Engine never imports Customer).
- **Frontend** (`src/app/customer/page.tsx`)
  - A prominent **primary-operation** card on Home, worded per industry from the Industry
    Experience Registry (`getIndustryExperience(profile.industry.key)`): Book Appointment /
    Book Site Visit / Request a Quote / Order …
  - Non-transactional industries → an in-app request modal that POSTs `engine.enquiry`
    (lands as a real CRM lead linked to the vendor). Transactional industries with a catalogue →
    the card sends the customer to browse the catalogue.
  - The catalogue's stale "contact them directly" line is replaced by the in-app primary action.

## KSM — deploy (no migration required for this step)
```bash
git pull origin get4domain-site
# rebuild BOTH images (the frontend rebuild is what surfaces the portal UI; the backend
# rebuild is what exposes POST /customer/actions/:intent)
docker compose build get4domain_backend get4domain_frontend
docker compose up -d get4domain_backend get4domain_frontend
```

## Verify (after deploy)
1. Sign in to `/customer` with a real contact's phone (OTP).
2. Home shows a **"Get started → <industry CTA>"** card.
3. Tap it → (non-transactional) a request modal prefilled with the contact's name/phone →
   submit → success state; (transactional) jumps to the catalogue.
4. Confirm the vendor's **CRM** now shows the new lead (source `website`), and the vendor
   received the in-app "New website enquiry" notification.

## Honest status (per the STEP 3 brief's checkpoint clause)
- **Complete:** the primary-operation in-app request path for all non-transactional industries,
  reusing the Action Registry; industry-worded CTA; non-breaking to the existing portal.
- **Not yet built (safe checkpoint — larger follow-on):** distinct per-industry client *screens*
  (My-Appointments vs Order-Tracking vs Payments-history as separate module views with their own
  data), in-app **checkout/payment** for product industries (needs vendor-Razorpay client flow),
  and the richer transactional intents (scheduled `realestate.site_visit`, `engine.checkout.order`)
  wired to bespoke forms. These reuse the same endpoint pattern; only the per-intent DTO/UI is added.
