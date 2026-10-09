# LeadSpace compliance pack

Prepared with the build (Dispatch B, 2026-10-10). This is working text for KSM, the CA and the lawyer to review, **not legal advice**. Everything that depends on a legal or tax opinion is listed in section 9 and is a setting or a text in code, so it can change without a rebuild of the idea.

## 1. Consent (DPDP Act)

Shown next to the "send me a code" button on every LeadSpace page, stored with every code request (`g4d_consent_records`: a one-way hash of the number, the text version, the page, the network hash and the time):

> I agree that this business, and Get4Domain on its behalf, may contact me on this number about my request, and that my name, number and request are shared with this business. I can ask for them to be deleted at any time.

- The text and its version (`ls-consent-v1`) live in `backend-api/src/leadspace/goals.ts`. A change of wording is a new version; old consent records keep the version the customer actually saw.
- No code is sent without the tick (`POST /leadspace/public/otp` refuses `consent: false`). A lead cannot be created without a verified code.
- The customer is told who receives the details (the business) and that they can ask for deletion (footer link on every page: "Delete my data").

## 2. What is stored and why

| Data | Where | Why | Kept |
|---|---|---|---|
| Name, mobile number, request (date, service, items, address, notes) | `g4d_lead_events` | to pass the request to the business that was asked | `retentionMonths` (default 24), then anonymised |
| One-way hash of the number | lead events, codes, consent, do-not-contact list | repeat detection (no double charge), rate limits, honouring a withdrawal | with the lead; the hash alone identifies nobody |
| One-time code | `g4d_lead_otps`, hash only, never the code | proves the number belongs to the customer | codes are deleted with the retention sweep |
| Messages sent from the common number | `g4d_whatsapp_message_logs`, number masked (98xxxxx210) | spam monitoring per vendor | not personal data in the log |
| Page views and button taps | `g4d_leadspace_daily_stats`, counts only | funnel | counts, no person |
| Money: purse ledger, invoices | `g4d_lead_purse_entries`, invoices | tax and accounting law | as the law requires; never anonymised or deleted |

Not stored: the customer's chat with the vendor (it happens on the vendor's own WhatsApp; the common number drops inbound messages and relays nothing), payment details (a LeadSpace page takes no payment).

## 3. Retention and deletion flow

1. **Customer asks** (footer link, or writes to privacy@get4domain.com / the vendor).
2. **KSM or a staff member checks who is asking** (the request should come from, or be confirmed on, the number concerned).
3. **Admin runs the deletion**: `POST /admin/leadspace/privacy/erase { phone }`. Effect, in one transaction: every lead for that number shows "Deleted customer", number `0000000000`, empty request and no vendor note; every stored code for that number is deleted; the number goes on the do-not-contact list, so no code is ever sent to it again (consent withdrawn).
4. **What stays**: the price charged, the dates and the purse ledger (books), and the hash.
5. **Automatic retention**: `POST /admin/leadspace/privacy/retention-sweep` (dry run by default; `{ "apply": true }` to write) anonymises leads older than `retentionMonths` (setting, default 24). Held leads the vendor has not seen are not touched. KSM runs it monthly until it is put on a schedule.
6. Vendors receive leads for a legitimate purpose the customer agreed to; they are told in the vendor terms (section 5) to use them only for that request and to delete on request.

A vendor's own request to delete their account: Support raises it; money records are kept as the law requires.

## 4. Privacy notice (text for the website `/privacy-policy`, LeadSpace section)

> **LeadSpace.** When you ask a business for something through a LeadSpace page, we ask for your name, mobile number and what you need. We send a one-time code to your WhatsApp number to check that the number is yours. We then give your name, number and request to that business so that it can contact you. We keep a record that you agreed, and when. We do not sell your details and we do not use them for our own marketing. The business may keep your details to serve your request, under its own responsibility. You can ask us to delete your details at any time (use "Delete my data" on the page or write to privacy@get4domain.com); we will remove your name, number and request and will not send you a code again. We keep the records of money that tax law requires, without your name or number. Details are kept for up to 24 months, then removed.

(Review: the grievance officer's name and contact, cross-border processing by Meta/Razorpay/Supabase, and the retention period.)

## 5. Vendor terms (LeadSpace section, for the vendor agreement)

1. **What you pay for.** A customer who verified their number on WhatsApp and asked for what your page offers (an enquiry, booking, appointment, site visit or order request). The price is fixed per kind of request, shown in your wallet before you pay and quoted at the moment the customer verifies; a later price change never changes what was already charged.
2. **Wallet.** Prepaid, used only for Get4Domain services. If it is empty your page keeps working and new customers are held for you; you see a count and a hidden number until you refill; refills release the oldest first and are charged at the price quoted when the customer verified. You may instead choose to show customers a polite message. Held customers are not lost.
3. **Invalid leads.** A request is not charged twice if the same customer asks again within the repeat window, and is not charged, with an automatic credit on record, if it comes from your own number or repeats inside the credit window. You may report any charged lead as not valid (wrong number, spam, not a real customer) within the dispute window (default 48 hours) with a reason; Get4Domain decides in a queue, and a credit is a ledger entry in your wallet. A customer who simply does not answer, changes their mind or is not a good fit is not an invalid lead. Get4Domain's decision on a dispute is final for that lead.
4. **Refunds and expiry.** Unused balance can be refunded on request, less the payment fee, for refills made in the last 12 months; unused balance expires after 24 months without activity. (Both are settings; wording to be confirmed by the CA/lawyer.)
5. **Conduct.** No illegal, misleading or prohibited content; no claims the trade may not make (guaranteed results; medical cures; advocate solicitation); prices on the page must be real. Pages that are not verified are not indexed or promoted. Get4Domain may review, suspend or remove a page, and pages can be reported by anyone.
6. **Regulated trades.** Advocates and clinics: information and enquiry pages only, not promoted unless Get4Domain allows it for that business. Real estate: a valid RERA number is shown on the page and on every post and is needed for promotion. You are responsible for your own professional rules.
7. **Customer data.** Use it only to respond to the request; do not add it to marketing lists without separate consent; delete it when asked; do not share it.
8. **Promotion.** Get4Domain decides where and when to promote; posts are written to rules (no guarantees, only prices on your page), approved by Get4Domain at first, and can be stopped by you or by Get4Domain at any time.
9. **Messages.** Alerts to you come from Get4Domain's WhatsApp number as utility messages; the conversation with your customer continues on your own number. Get4Domain does not read or relay it.
10. **Tax.** A GST tax invoice is issued for every refill. Leads are not goods; the treatment is stated on the invoice.

## 6. WhatsApp templates (common Get4Domain number)

Only authentication and utility categories are registered; code refuses anything else (`whatsapp-gateway.service.ts`, guarded by `scripts/leadspace-guard.mjs`). No bulk or free-text send exists. Submit these to Meta for approval; the admin screen (Admin > LeadSpace > WhatsApp number) shows each template's approval status and the common number reads **Live** only when the credentials are set and `leadspace_otp` is Approved. Until then it runs in test mode ("Awaiting approval").

| Template | Category | Text | Sample |
|---|---|---|---|
| `leadspace_otp` | AUTHENTICATION | `{{1}} is your verification code. It is valid for 5 minutes. Do not share this code with anyone.` | 482913 is your verification code. It is valid for 5 minutes. Do not share this code with anyone. |
| `leadspace_new_lead` | UTILITY | `New {{1}} for {{2}}: {{3}}, {{4}}. Tap to chat with the customer: {{5}}` | New enquiry for Ravi Plumbing: Priya Kumar, a message. Tap to chat with the customer: https://wa.me/919876543210 |
| `leadspace_held_leads` | UTILITY | `{{1}} new customer(s) are waiting for {{2}}. Refill your LeadSpace wallet to see their details: {{3}}` | 2 new customer(s) are waiting for Ravi Plumbing. Refill your LeadSpace wallet to see their details: https://get4domain.com/dashboard |
| `leadspace_low_balance` | UTILITY | `Your LeadSpace wallet for {{1}} is low: {{2}} left. Refill to keep receiving customers: {{3}}` | Your LeadSpace wallet for Ravi Plumbing is low: Rs 200 left. Refill to keep receiving customers: https://get4domain.com/dashboard |
| `leadspace_refill_receipt` | UTILITY | `Thank you. {{1}} was added to the LeadSpace wallet of {{2}}. Your tax invoice {{3}} has been e-mailed.` | Thank you. Rs 1,999 was added to the LeadSpace wallet of Ravi Plumbing. Your tax invoice INV-2026-0042 has been e-mailed. |

Rules enforced in code: no promotional wording in a template or its values; at most 12 messages a day to one number; every send is logged against its vendor with the number masked (spam monitor: `GET /admin/leadspace/whatsapp/log`); a vendor page that sends many codes nobody uses is cut off for the day; no code is sent to a blocked number.

## 7. Regulated-trade rules (switches are built; the policy is for the lawyer)

- **Advocates**: the page is information plus an enquiry form only (goal is forced to Enquiry), with a visible disclaimer; blocked claims (best, guaranteed, "win your case"...); never promoted unless an admin enables it for that advocate; noindex until a person reviews it. *To confirm with a lawyer: whether any form of promotion or lead-generation is permitted under the Bar Council of India Rules, and the exact disclaimer.*
- **Clinics and doctors**: information and appointment request only, medical disclaimer, no medical claims in page text or generated posts (cure, painless, best doctor...), not promoted unless an admin enables it, noindex until reviewed. *To confirm: advertising rules for medical practitioners (NMC regulations, state rules).*
- **Real estate**: a RERA number is required to promote, is shown on the page and appended to every post (a post without it is refused), "assured returns" style claims are blocked. *To confirm: whether the page itself needs RERA to be shown at all for plots and rentals.*
- **AI Studio guardrails** for everything LeadSpace writes or posts: no guaranteed outcomes, no price that is not on the page, no before-and-after claims, no superlatives; text that breaks them is discarded and the plain template text is used.

## 8. Abuse controls (summary)

Vendor phone verified by code before a page is indexed or promoted; business-name and trade check; blocked-word list (admin editable); report link on every page; unverified pages noindex and never promoted; page creation limited per network per day; admin suspend with a reason; code limits per phone, device and network per hour; do-not-contact list.

## 9. Open questions for the CA and the lawyer

**CA / tax**
1. GST on a wallet refill: is it a prepaid instrument for services (GST on use) or a supply on receipt (GST at refill)? The build issues a GST invoice at refill with GST **inclusive or added**, per pack and for custom amounts (admin switch), and the credited amount is separately configurable. Which is right, and what is the place-of-supply and SAC code to print?
2. Expiry of unused balance: is it income, and when? Refund less payment fee: is the fee GST-able?
3. Invalid-lead credits: confirm they are a price adjustment (credit note) and whether a credit note document is needed besides the ledger entry.
4. Held leads released later: is the supply at capture or at release?
5. Cost per lead report uses GST-exclusive revenue (price divided by 1 + GST); confirm the margin definition.

**Lawyer**
1. Consent wording and the retention period under the DPDP Act; whether a notice in the page itself is needed; grievance officer details.
2. Whether Get4Domain is a data fiduciary or processor for the lead data it passes to the vendor, and the vendor agreement needed.
3. Regulated trades (section 7): advocates, doctors, real estate. Whether these may be offered LeadSpace at all.
4. WhatsApp: use of one common number for OTP and utility alerts across many businesses under Meta's policies; the commerce policy for Cart-order pages.
5. Refund and expiry terms for prepaid balance (RBI prepaid-instrument rules: confirm a closed-loop balance usable only for Get4Domain services is outside them).
6. Dispute rules (section 5.3) and the binding nature of Get4Domain's decision.
7. Social posting for vendors from Get4Domain's pages: platform terms and any disclosure of paid promotion.
