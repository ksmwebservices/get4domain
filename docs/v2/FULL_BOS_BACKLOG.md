# Full BOS backlog (stays Coming soon; nothing here is hidden or pretended)

Effort: S under a day, M a few days, L about a week or more, XL a project. Source: [the 2026-10-09 audit](evidence/full-bos/AUDIT_2026-10-09.md). Every item below shows "Coming soon" (or is not listed) in the dashboard until it is built and has a passing test.

## Not built, outside the spine

| Feature (registry id) | Effort | Depends on | Suggested release |
|---|---|---|---|
| HR and payroll (`people.hr`) | XL | staff records (Party), attendance, statutory rules per state | 2 |
| Branches, departments, audit log (`people.team-pro`) | M | team roles in place | 1B |
| Pitch scripts, assignment, sales reports (`sales.lead-tools`) | L | leads and quotes now share the spine | 1B |
| Social posting (`marketing.social`) | L | each network's publishing approval | 2 |
| Reviews and offers (`marketing.reviews-offers`) | M | customers (Party) | 1B |
| SMS and e-mail hub (`communication.sms-email`) | M | provider keys, DLT registration | 1B |
| Reminders and feedback (`communication.reminders`) | M | scheduled jobs exist (payment reminders are built) | 1B |
| Add new website pages (`website.new-pages`) | L | page builder | 2 |
| AI answers, Google tools (`website.search-pro`) | L | Google API access | 2 |
| Full industry workspace (`commerce.workspace-full`) | L | per-industry screens on the spine | 2 |
| Tasks and workflow (`commerce.tasks`) | L | | 2 |
| Documents (`commerce.documents`) | L | file storage | 2 |
| Connections (`account.connections`) | L | OAuth per service | 2 |
| Website disclosures (`account.disclosures`) | M | legal copy | 1B |
| BOS Custom screens (`custom.*`) | per quote | quote-only, unchanged | n/a |
| AI agents, automatic calling | XL | telephony and agent platform | 2+ |
| Reels and video in AI Studio | L | video provider; today they are Coming soon and never debit the wallet | 2 |

## Finish-lines on what is built

| Item | Effort | Note |
|---|---|---|
| Marketing pages still type prices (606 lines in 44 files, guarded so it can only shrink) | M | generate from `lib/pricing.ts` / live pricing; the vendor dashboard is already clean |
| Draw the UPI QR image on invoices | S | today the UPI ID and a tap-to-pay link are shown |
| Define sizes and colours on a product (so the website offers them) | M | today a size is typed or picked on the bill and counted per size once stock is entered |
| Post the older invoices and expenses (pre-BOS tables) into the books | M | needs a decision on which old rows are trustworthy; today only opening balances are posted by the backfill |
| Expense on credit (pay a supplier later) from the Expenses form | S | supplier bills go through Purchases today |
| Low-stock message by WhatsApp or SMS | S | in-app notification is built; needs the messaging key per vendor |
| One-paisa difference when a tax-inclusive line is credited in full | S | the credit never exceeds the line; documented |
| GST filing integration (returns are tables for the CA) | XL | GSP partner |
| Opening balances for suppliers on the first screen | S | possible when adding the supplier; no separate screen |
