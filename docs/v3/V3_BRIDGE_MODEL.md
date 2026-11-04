# V3 Bridge Model: Free versus Pro, canonical host, seeded sites, plan lifecycle

Frozen by the owner on 4 November 2026. Section 1 is the owner's text, verbatim. Every Batch 3 slice implements these rules as requirements. Where a later document disagrees with this file, this file wins.

## 1. Owner rules (verbatim)

1. Get4Domain is a local domain search engine for businesses. A directory result does not open a directory page; it opens the business's own subdomain site. The directory has NO forms, no callback request and no lead delivery. Its only action is Visit site. Sponsored cards stay labelled.
2. Every vendor has a Get4Domain subdomain. It is mandatory for Free and Pro and cannot be removed. Pro may also add a custom domain; both may be live.
3. Get4Domain's own promotion (directory placement, SEO, our own Google and Meta ads) covers the SUBDOMAIN only. Promoting a custom domain is a managed-services add-on pack.
4. Canonical rule: exactly one canonical host per site. Default canonical is the subdomain; the custom domain serves the same site and declares the subdomain canonical. While the custom-domain promotion add-on is active the custom domain is canonical and the subdomain redirects to it (the directory still links the subdomain). When the add-on ends the canonical returns to the subdomain through a controlled switch recorded in the site events. Only the canonical host appears in the sitemap. The setting cartRequiresCustomDomain must not exist.
5. Free sites are informational listings: name, category, address, phone number as plain text (no tel: link, no button), hours, map, services list, photos, public facts, basic category template. NO call to action of any kind (no forms, booking, quote, cart, WhatsApp button, call button). A Free vendor can sign in and manage details; Pro features appear as LOCKED_PREVIEW; a Free vendor receives no leads, bookings or orders. One email and one phone per Free vendor.
6. Pro sites (subdomain or custom domain) have the full call-to-action set by category, cart, booking, offers and coupons.
7. Bridge model: we deliver requests to the vendor; we never receive or hold a customer's money; online payment goes only to the vendor's own gateway or UPI account; the vendor issues their own invoice; WhatsApp, SMS and email are triggered by us on the vendor's behalf; we promise promotion effort, never leads or rankings. Cart payment readiness: gateway or UPI connected gives full online checkout; no gateway gives an order request (pay on delivery, at the visit, or as the vendor arranges); nothing configured gives product enquiry and booking requests only with no checkout button. A gateway is required only for online payment.
8. Seeded sites: admin and team create many Free sites from public facts as promotion pages. States SEEDED, INVITED, CLAIMED_FREE, PRO, REMOVED. Every directory listing always has a Free site behind it. Seeded pages carry a visible line: "This page was created from public information. Is this your business? Claim it or ask us to remove it." Removal is honoured promptly and is permanent unless the owner asks again. Search indexing of seeded sites is controlled by the setting seededSiteIndexingMode (OFF or QUALITY), default OFF, until counsel approves.

9. Never hide, hold or delete a business site or listing. When a Pro plan expires, after the grace period the site becomes a Free listing-only site (nothing deleted, the chosen Pro theme and content are kept and restore when Pro returns), stays on its subdomain, and stays listed in the directory; staff decide to formally convert it to the Free plan or to restore Pro at any time, and the vendor can renew at any time. A suspended vendor is treated the same way: the site and listing stay live as Free listing-only, Pro features stop (forms, checkout, requests, payments), nothing is deleted. A site or listing is hidden or deleted ONLY (a) when the vendor personally asks for deletion (identity-checked, then permanently removed from every listing and never listed again for any purpose, recorded in the removal register) or (b) when staff delete an empty listing that has no business details. There is no other hide or hold state in this batch.

## 2. Plan lifecycle (implements owner rule 9; slice 5.1d)

The dispatch refers to this as "the lifecycle in B3.6"; there is no task B3.6 in the queue, so the lifecycle is written here from rule 9 and slice 5.1d.

| State of the vendor | Effective entitlements | Site | Directory listing |
|---|---|---|---|
| ACTIVE paid subscription | the subscribed Pro plan | full Pro site | listed |
| Subscription ended, inside the grace period | the Pro plan, with a warning flag | full Pro site | listed |
| Grace period over | the track's Free plan | Free listing-only site on the subdomain; the chosen Pro theme and content are kept | listed |
| Vendor PENDING | by plan | served | listed |
| Vendor SUSPENDED | the track's Free plan (Pro features stop: forms, checkout, requests, payments) | Free listing-only site, live | listed |
| REMOVED | none | uniform 404 (identical to an unknown host), noindex, removal register | never listed again |

* Nothing is deleted by expiry or suspension. Pro data (theme, page content, products, requests, orders, payment methods, offers, domain records) is kept, locked, and restores automatically when Pro is active again.
* Staff (SUPER_ADMIN, OPERATIONS; reason required; audited; MARKETING denied) may convert a vendor to the Free plan, restore Pro, extend grace and reinstate a suspended vendor. The vendor may renew or upgrade at any time.
* A site or listing is hidden or deleted ONLY when (a) the vendor personally asks for deletion (identity re-checked with a fresh one-time code, then permanently removed from every listing, the phone hash added to the removal register) or (b) staff delete an empty listing that has no business details. There is no other hide or hold state in this batch.

## 3. What Free and Pro mean in the product

* Free: informational listing only. No call to action of any kind, no leads, bookings or orders.
* Pro: the full call-to-action set by category, plus the cart, booking, offers and coupons.
* Seeded sites are Free sites; every directory listing has a Free site behind it.
* The directory only sends visitors to the business's own subdomain site (Visit site). It has no forms and delivers no leads.

## 4. Bridge statement

We deliver requests to the vendor. We never receive or hold a customer's money. Online payment goes only to the vendor's own gateway or UPI account. The vendor issues their own invoice. We promise promotion effort, never leads or rankings.
