export interface SettingDefinition {
  key: string;
  label: string;
  /** process.env name used as a fallback until the DB value is configured. */
  envFallback: string;
  secret: boolean;
}

export interface CategoryDefinition {
  key: string;
  label: string;
  settings: SettingDefinition[];
}

// Categories + known keys surfaced in the Admin → Integrations UI. Values are
// encrypted at rest; each falls back to process.env until configured in DB.
export const SETTING_CATEGORIES: CategoryDefinition[] = [
  {
    // Company details printed on GST invoices (Get4Domain / KSM Quantum). Admin
    // sets the real GSTIN/PAN/address once; invoices read these (env fallback).
    key: 'company',
    label: 'Company (Invoice Details)',
    settings: [
      { key: 'name', label: 'Legal Company Name', envFallback: 'COMPANY_NAME', secret: false },
      { key: 'gstin', label: 'GSTIN', envFallback: 'COMPANY_GST', secret: false },
      { key: 'pan', label: 'PAN', envFallback: 'COMPANY_PAN', secret: false },
      { key: 'address', label: 'Registered Address', envFallback: 'COMPANY_ADDRESS', secret: false },
      { key: 'phone', label: 'Phone', envFallback: 'COMPANY_PHONE', secret: false },
      { key: 'email', label: 'Billing Email', envFallback: 'COMPANY_EMAIL', secret: false },
      { key: 'logo_url', label: 'Logo URL (https)', envFallback: 'COMPANY_LOGO_URL', secret: false },
    ],
  },
  {
    key: 'payment',
    label: 'Payment (Razorpay)',
    settings: [
      { key: 'razorpay_key_id', label: 'Razorpay Key ID', envFallback: 'RAZORPAY_KEY_ID', secret: false },
      { key: 'razorpay_key_secret', label: 'Razorpay Key Secret', envFallback: 'RAZORPAY_KEY_SECRET', secret: true },
      { key: 'razorpay_webhook_secret', label: 'Razorpay Webhook Secret', envFallback: 'RAZORPAY_WEBHOOK_SECRET', secret: true },
    ],
  },
  {
    key: 'ai',
    label: 'AI (Claude / OpenAI)',
    settings: [
      { key: 'anthropic_api_key', label: 'Claude / Anthropic API Key', envFallback: 'CLAUDE_API_KEY', secret: true },
      { key: 'openai_api_key', label: 'OpenAI API Key', envFallback: 'OPENAI_API_KEY', secret: true },
    ],
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp (BSP)',
    settings: [
      { key: 'bsp_provider', label: 'BSP Provider', envFallback: 'WHATSAPP_BSP_PROVIDER', secret: false },
      { key: 'bsp_api_key', label: 'BSP API Key', envFallback: 'WHATSAPP_BSP_API_KEY', secret: true },
      { key: 'bsp_account_id', label: 'BSP Account ID', envFallback: 'WHATSAPP_BSP_ACCOUNT_ID', secret: false },
    ],
  },
  {
    key: 'sms',
    label: 'SMS (MSG91 / Kaleyra)',
    settings: [
      { key: 'sms_api_key', label: 'SMS API Key', envFallback: 'MSG91_AUTH_KEY', secret: true },
      { key: 'sms_sender_id', label: 'DLT Sender ID', envFallback: 'MSG91_SENDER_ID', secret: false },
    ],
  },
  {
    // Fast2SMS — single central Get4Domain account funding SMS + OTP + WhatsApp.
    // Preferred provider for the v2.0 Communication Hub / Book-Demo OTP. Vendors
    // never see Fast2SMS; usage is debited from their wallet per message.
    key: 'fast2sms',
    label: 'Fast2SMS (SMS · OTP · WhatsApp)',
    settings: [
      { key: 'api_key', label: 'Fast2SMS API Key', envFallback: 'FAST2SMS_API_KEY', secret: true },
      { key: 'sender_id', label: 'DLT Sender ID', envFallback: 'FAST2SMS_SENDER_ID', secret: false },
      { key: 'dlt_entity_id', label: 'DLT Entity ID', envFallback: 'FAST2SMS_ENTITY_ID', secret: false },
      { key: 'sms_message_id', label: 'DLT SMS Template/Message ID', envFallback: 'FAST2SMS_SMS_MESSAGE_ID', secret: false },
      { key: 'wa_message_id', label: 'WhatsApp Template/Message ID', envFallback: 'FAST2SMS_WA_MESSAGE_ID', secret: false },
    ],
  },
  {
    key: 'email',
    label: 'Email (Resend)',
    settings: [
      { key: 'resend_api_key', label: 'Resend API Key', envFallback: 'RESEND_API_KEY', secret: true },
      { key: 'from_email', label: 'From Email', envFallback: 'RESEND_FROM_EMAIL', secret: false },
    ],
  },
  {
    key: 'meta',
    label: 'Meta (Facebook / Instagram)',
    settings: [
      { key: 'app_id', label: 'Meta App ID', envFallback: 'META_APP_ID', secret: false },
      { key: 'app_secret', label: 'Meta App Secret', envFallback: 'META_APP_SECRET', secret: true },
      { key: 'access_token', label: 'System User Token', envFallback: 'META_ACCESS_TOKEN', secret: true },
    ],
  },
  {
    key: 'google_ads',
    label: 'Google Ads',
    settings: [
      { key: 'developer_token', label: 'Developer Token', envFallback: 'GOOGLE_ADS_DEVELOPER_TOKEN', secret: true },
      { key: 'client_id', label: 'OAuth Client ID', envFallback: 'GOOGLE_ADS_CLIENT_ID', secret: false },
      { key: 'client_secret', label: 'OAuth Client Secret', envFallback: 'GOOGLE_ADS_CLIENT_SECRET', secret: true },
    ],
  },
  {
    key: 'push',
    label: 'Web Push (VAPID)',
    settings: [
      { key: 'vapid_public_key', label: 'VAPID Public Key', envFallback: 'VAPID_PUBLIC_KEY', secret: false },
      { key: 'vapid_private_key', label: 'VAPID Private Key', envFallback: 'VAPID_PRIVATE_KEY', secret: true },
    ],
  },
  {
    key: 'video',
    label: 'Video (Runway / HeyGen)',
    settings: [
      { key: 'runway_api_key', label: 'Runway ML API Key', envFallback: 'RUNWAY_API_KEY', secret: true },
      { key: 'heygen_api_key', label: 'HeyGen API Key', envFallback: 'HEYGEN_API_KEY', secret: true },
    ],
  },
  {
    key: 'domain',
    label: 'Domain (ResellerClub)',
    settings: [
      { key: 'resellerclub_api_key', label: 'ResellerClub API Key', envFallback: 'RESELLERCLUB_API_KEY', secret: true },
      { key: 'resellerclub_reseller_id', label: 'ResellerClub Reseller ID', envFallback: 'RESELLERCLUB_RESELLER_ID', secret: false },
    ],
  },
  {
    // Non-secret wallet rate card. Admin-editable; backend deduction logic can
    // read these (falls back to hardcoded defaults until wired end-to-end).
    key: 'pricing',
    label: 'Pricing (Wallet Rates)',
    settings: [
      { key: 'social_post', label: 'Social media post (₹)', envFallback: 'PRICE_SOCIAL_POST', secret: false },
      { key: 'festival_poster', label: 'Festival poster (₹)', envFallback: 'PRICE_FESTIVAL_POSTER', secret: false },
      { key: 'blog_article', label: 'Blog article (₹)', envFallback: 'PRICE_BLOG_ARTICLE', secret: false },
      { key: 'reel_script', label: 'Reel/Video script (₹)', envFallback: 'PRICE_REEL_SCRIPT', secret: false },
      { key: 'video_generation', label: 'Video generation (₹)', envFallback: 'PRICE_VIDEO_GENERATION', secret: false },
      { key: 'document', label: 'Document (₹)', envFallback: 'PRICE_DOCUMENT', secret: false },
      { key: 'whatsapp_message', label: 'WhatsApp per message (₹)', envFallback: 'PRICE_WHATSAPP', secret: false },
      { key: 'sms_message', label: 'SMS per message (₹)', envFallback: 'PRICE_SMS', secret: false },
      { key: 'email_message', label: 'Email per email (₹)', envFallback: 'PRICE_EMAIL', secret: false },
      { key: 'social_post_publish', label: 'Social post (we post) (₹)', envFallback: 'PRICE_SOCIAL_PUBLISH', secret: false },
      { key: 'extra_campaign_page', label: 'Extra campaign page (₹)', envFallback: 'PRICE_CAMPAIGN_PAGE', secret: false },
      { key: 'domainapp_monthly', label: 'DomainApp monthly (₹)', envFallback: 'PRICE_DOMAINAPP_MONTHLY', secret: false },
      { key: 'topup_999_credits', label: '₹999 top-up → credits', envFallback: 'PRICE_TOPUP_999', secret: false },
      { key: 'topup_2499_credits', label: '₹2,499 top-up → credits', envFallback: 'PRICE_TOPUP_2499', secret: false },
      { key: 'topup_4999_credits', label: '₹4,999 top-up → credits', envFallback: 'PRICE_TOPUP_4999', secret: false },
      // Plan-tier free wallet credit (admin-editable). Trial gets its own free
      // amount; Pro includes the ₹999 AI Studio credit from the pricing model.
      { key: 'trial_free_credit', label: 'Trial plan — free credit (₹)', envFallback: 'PRICE_TRIAL_FREE_CREDIT', secret: false },
      { key: 'pro_free_credit', label: 'Pro plan — free credit (₹)', envFallback: 'PRICE_PRO_FREE_CREDIT', secret: false },
    ],
  },
];

export const CATEGORY_MAP = new Map(SETTING_CATEGORIES.map((c) => [c.key, c]));

export function findSetting(category: string, key: string): SettingDefinition | undefined {
  return CATEGORY_MAP.get(category)?.settings.find((s) => s.key === key);
}
