import json, os, re
T = os.environ['TEMP'].replace('\\', '/') + '/audit/'
inv = json.load(open(T + 'inventory.json', encoding='utf-8'))

# Menu placement exactly as in get4domain_mvp/src/app/dashboard/layout.tsx (sections array)
NAV = {
    '/dashboard': ('Overview', 'Home', 'always'),
    '/dashboard/campaigns': ('Growth Hub', 'Grow', 'module growth_hub'),
    '/dashboard/telecrm': ('TeleCRM', 'Grow', 'module telecrm'),
    '/dashboard/ai-studio': ('AI Studio', 'Grow', 'wallet-gated (never locked)'),
    '/dashboard/communication': ('Communication Hub', 'Grow', 'module communication_hub'),
    '/dashboard/whatsapp-bot': ('WhatsApp Bot', 'Grow', 'module communication_hub'),
    '/dashboard/my-products': ('My Products', 'Manage', 'module website_manager'),
    '/dashboard/my-website': ('Website Manager', 'Manage', 'module website_manager'),
    '/dashboard/website-engine': ('Website Engine', 'Manage', 'module website_manager'),
    '/dashboard/embed': ('Embed / Widget', 'Manage', 'module website_manager'),
    '/dashboard/domain-management': ('Domain', 'Manage', 'always'),
    '/dashboard/orders': ('Website Orders', 'Manage', 'module website_manager'),
    '/dashboard/customer-hub': ('Customer Hub', 'Manage', 'module customer_hub'),
    '/dashboard/reports': ('Analytics Hub', 'Manage', 'module analytics_hub'),
    '/dashboard/go-live': ('Subscription', 'Account', 'always'),
    '/dashboard/settings': ('Profile + Settings (two entries, one page)', 'Account', 'always'),
    '/dashboard/wallet': ('Wallet & Billing', 'Account', 'always'),
    '/dashboard/payments': ('Payments', 'Account', 'always'),
    '/dashboard/invoices': ('Invoices', 'Account', 'always'),
    '/dashboard/accounts': ('Accounts', 'Account', 'always (not plan-gated)'),
    '/dashboard/hrm': ('HRM', 'Account', 'always (not plan-gated)'),
    '/dashboard/stationery': ('Stationery', 'Account', 'always'),
    '/dashboard/team': ('Team', 'Account', 'owner only'),
    '/dashboard/support': ('Support', 'Account', 'always'),
    '/dashboard/domain-app/[tab]': ('<industry tabs> (3–7 per industry)', 'Industry', 'module domainapp + addon per tab'),
}
TABLES = [
    (r'/cms/vendor/:id/products|/cms/products', 'VendorProduct, Category'),
    (r'/cms/vendor/:id$|/cms/vendor', 'VendorCMS'),
    (r'/website-themes', 'WebsiteTheme, VendorTemplateUnlock, Subscription (theme counter)'),
    (r'/domains', 'DomainRegistration (+ ResellerClub)'),
    (r'/crm/', 'CampaignLead, CallLog'),
    (r'/domainapp/contacts', 'Contact'),
    (r'/domainapp/invoices|/domainapp/invoices', 'GenericInvoice'),
    (r'/domainapp/(catalog)', 'CatalogItem'),
    (r'/domainapp/records|/domainapp/summary', 'Record'),
    (r'/accounting', 'Expense, PaymentRecord, GstFiling'),
    (r'/wallet', 'Wallet, WalletTransaction'),
    (r'/invoices/vendor|/invoices/:id', 'Invoice (platform → vendor)'),
    (r'/payments/create-order|/payments/verify', 'Invoice, Payment (platform Razorpay)'),
    (r'/billing', 'Invoice, BillingTerm, ManualPaymentSubmission, PlanChangeRequest'),
    (r'/subscriptions', 'Subscription'),
    (r'/team', 'TeamMember'),
    (r'/vendor-payments', 'VendorPaymentConfig'),
    (r'/campaign-pages|/campaigns', 'CampaignPage, Campaign'),
    (r'/whatsapp-bot', 'WhatsApp KB / conversations'),
    (r'/communication|/vendor-comms', 'comm threads, VendorCommsSettings'),
    (r'/engine/', 'PosSale (type web), engine actions'),
    (r'/retail', 'RetailProduct, PosSale (type retail)'),
    (r'/stationery', 'StationeryOrder'),
    (r'/support', 'SupportTicket'),
    (r'/ai/|/design/|/business-documents|/reels|/video', 'Wallet, WalletTransaction (+ provider APIs)'),
    (r'/notifications', 'Notification'),
    (r'/industries|/modules|/addons', 'industry config (code), VendorModule, VendorAddon'),
    (r'/analytics', 'usage aggregates'),
    (r'/demo/buy', 'Vendor, Subscription, Invoice, Wallet'),
    (r'/widget', 'widget key'),
    (r'/domain-campaign', 'DomainCampaign records'),
    (r'/customer/', 'customer portal'),
]

def clean_eps(o):
    eps = []
    for e in o['endpoints']:
        if '/admin/commerce' in e or e.startswith('commerceApi'):
            continue  # import-chain artefact (lib/commerce.ts exports both admin and vendor clients)
        p = e.split(' → ')[-1] if ' → ' in e else e
        p = re.sub(r'^(GET|POST|PUT|PATCH|DELETE) ', '', p)  # verbs from the static scan are unreliable, show paths only
        p = p.replace('apiCall ', '').replace('fetch ', '')
        if p.startswith(':id/'):
            p = '/billing/invoices/' + p
        if p not in eps:
            eps.append(p)
    return eps

def tables_for(eps):
    out = []
    for e in eps:
        for pat, t in TABLES:
            if re.search(pat, e):
                for x in t.split(', '):
                    if x not in out:
                        out.append(x)
                break
    return out

rows = []
for o in sorted(inv, key=lambda x: (NAV.get(x['route'], ('~', 'z', ''))[1] != 'Home', NAV.get(x['route'], ('~', 'z', ''))[1], x['route'])):
    label, sec, gate = NAV.get(o['route'], ('(not in menu)', '—', '—'))
    eps = clean_eps(o)
    shown = ', '.join(f'`{e}`' for e in eps[:5]) + (f' +{len(eps) - 5} more' if len(eps) > 5 else '')
    tbl = ', '.join(tables_for(eps)[:6])
    comp = o['page'].replace('app/dashboard/', '').replace('/page.tsx', '') or 'page'
    subs = [f.split('/')[-1] for f in o['files'][1:] if 'components' in f or 'domainapp' in f or 'telecrm' in f or f.startswith('app/')][:3]
    rows.append(f"| `{o['route']}` | {label} | {sec} | {gate} | {o['pageLines']}/{o['totalLines']} | {o['last']} | {shown or '—'} | {tbl or '—'} |")

md = ['| Route | Menu label | Menu section | Gating (from `layout.tsx` / `dashboard-config.ts`) | Lines (page / incl. imports) | Last changed | Backend endpoints called (static scan) | Tables touched |', '|---|---|---|---|---:|---|---|---|']
md += rows
open(T + 'inventory-table.md', 'w', encoding='utf-8').write('\n'.join(md))
print(len(rows), 'rows written')
