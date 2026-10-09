# LeadSpace pilot runbook

For KSM. Nothing here runs by itself. Every script is a **dry run unless you add `--apply`** and is safe to run twice. Run them in the VM terminal from `/srv/get4domain-site/backend-api` after the deploy in `DEPLOYMENT.md` section 9 (needs `npx nest build` output in `dist/`).

## 1. First full test (one test vendor, before any real vendor)

Use a test account in the style of `ksm-webtech-services`.

1. Register at `https://get4domain.com/register?product=leadspace` (a LeadSpace-only account). You land on the five-tab app.
2. **Page** tab: Create (trade, city, name). Add two services with prices. Press **Send code** under Verify your WhatsApp number. While the common number is not approved, read the code in Admin > LeadSpace > WhatsApp number > Test mode outbox. Publish.
3. Admin > LeadSpace > Prices and rules: set a price for the kind of request your page takes (there are no starting prices in code).
4. Open the page `/ls/<slug>` on a phone from another number. Fill the form, request the code (outbox again), confirm. The wallet is empty, so the lead is **held**: the customer sees the normal thank-you; the Home tab shows 1 waiting; the Leads tab shows a masked number.
5. **Wallet** tab: refill with the smallest pack (real Razorpay, small amount). Check: the tax invoice arrives by e-mail and is listed under Wallet; the held lead is released; the ledger shows the refill credit and the lead deduction with running balance.
6. A second customer request: delivered at once, one deduction. Report it as invalid in the Leads tab; in the admin Credits tab credit it; the ledger shows the credit.
7. Promote tab: switch on, "Write next month's posts"; approve them in Admin > LeadSpace > Promotion. With no social account connected they appear as manual tasks; with a test-mode account they appear in the post log.

Only after step 7 passes: go on.

## 2. Ten pilot vendors

Write `pilots.json` (one object per vendor):

```json
[
  { "name": "Ravi Kumar", "email": "ravi@example.com", "phone": "9840011111", "businessName": "Ravi Plumbing Works", "category": "home-services", "city": "Chennai",
    "services": [{ "name": "Tap repair", "price": 350 }], "tagline": "Leaks fixed the same day" }
]
```

`category` is one of: `home-services`, `builders-interiors`, `real-estate`, `freelancer`, `startup`, `photography-events`, `tutor`, `salon-beauty`, `shop-retail`, `restaurant-food`, `advocate`, `clinic`. `goal` is optional (the trade's usual goal is used; advocates are always Enquiry).

```
node scripts/leadspace-onboard-pilots.js --file pilots.json            # check every entry, write nothing
node scripts/leadspace-onboard-pilots.js --file pilots.json --apply    # create vendor, LeadSpace-only mode, draft page, inactive promotion plan
```

It prints, per vendor, a temporary password (send it, and ask them to change it) and the checklist of what only the vendor can do: verify their WhatsApp number with a code, press Publish, make the first refill, switch promotion on. KSM approves the first posts of each vendor in the Promotion tab for the first two weeks.

## 3. Test campaigns (KSM's manual Phase 0 ads)

```
node scripts/leadspace-test-campaign-kit.js --city Chennai --phone 98xxxxxxxx                 # dry run: the twelve trades and their links
node scripts/leadspace-test-campaign-kit.js --city Chennai --phone 98xxxxxxxx --apply --publish
```

It makes twelve internal test vendors (`test-<trade>-<city>@get4domain.com`, empty wallets so leads are captured and held, nobody is charged), each with a page, and writes `leadspace-test-campaigns-<yyyymm>.csv` to fill in. Verify the page numbers afterwards if you want them indexed (they are noindex until verified).

**UTM convention** for every ad link:

| Parameter | Value |
|---|---|
| `utm_source` | `meta`, `google` or `other` |
| `utm_medium` | `paid` |
| `utm_campaign` | `<trade>-<city>-<yyyymm>` in lower case, for example `home-services-chennai-202610` |
| `utm_content` | the creative number (`1`, `2`...) |

Record each boost under Admin > LeadSpace > Cost per lead > Ad spend with the **utm_campaign in the note** (for example "boost 1 home-services-chennai-202610"). The sheet, `GET /admin/leadspace/test-campaign-sheet.csv` (also JSON without `.csv`), then lists per campaign: verified leads, held, credited, spend, **cost per verified lead**. Cost per verified lead by trade and city, with the margin alert, is also under Cost per lead in the admin. Spend recorded for a campaign that has no leads yet still shows as a row, so a wasted boost is visible. Start with about three trades and a small budget each, and measure before you set prices.

## 4. Merging the old Campaigns and landing pages (Allwin Tours and others)

```
node scripts/leadspace-migrate-campaigns.js                            # dry run for everyone who has campaign data
node scripts/leadspace-migrate-campaigns.js --vendor allwin-tours      # dry run for one vendor
node scripts/leadspace-migrate-campaigns.js --vendor allwin-tours --apply
node scripts/leadspace-migrate-campaigns.js --vendor allwin-tours --rollback           # what a rollback would remove
node scripts/leadspace-migrate-campaigns.js --vendor allwin-tours --rollback --apply
```

It is a copy; no old row is changed or deleted. The old landing page becomes a **draft** LeadSpace page at the same address slug; `/go/<slug>` keeps serving the old page (so running ads keep working) until the vendor publishes the new one, after which `/go/<slug>` redirects there. Paste the dry-run output to Claude before `--apply`. A vendor can also do it themselves from the banner on the LeadSpace Home tab.

## 5. Funnel and monthly chores

- Per vendor: Promote tab (vendor) and `GET /admin/leadspace/vendors/<id>/funnel`: views, button taps, forms started, codes requested, verified events by kind, held, delivered, contacted, won, credited, charged, cost per verified event.
- Monthly until scheduled: `POST /admin/leadspace/privacy/retention-sweep` (dry run, then `{"apply": true}`) and `POST /admin/leadspace/expiry-sweep`.
- Submit `https://get4domain.com/sitemap-leadspace.xml` in Google Search Console once (the Promotion tab has the steps and a Done button).
