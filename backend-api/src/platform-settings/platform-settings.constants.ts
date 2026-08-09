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
];

export const CATEGORY_MAP = new Map(SETTING_CATEGORIES.map((c) => [c.key, c]));

export function findSetting(category: string, key: string): SettingDefinition | undefined {
  return CATEGORY_MAP.get(category)?.settings.find((s) => s.key === key);
}
