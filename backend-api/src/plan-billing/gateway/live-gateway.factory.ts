import { RazorpayTestAdapter } from '../razorpay/razorpay.port';
import { CashfreeGateway } from './cashfree.gateway';
import { GatewayName } from './gateway-core';
import { PaymentGatewayPort } from './gateway.port';
import { RazorpayGateway } from './razorpay.gateway';

/**
 * The LIVE adapters of the payment port (Wave 3 Part C), made only here and only from the environment. The legacy gate (PaymentsGate.port, used by the wallet) still has no live branch at all; the plan
 * checkout reaches live ONLY through PaymentsGate.gatewayPort, which asks this factory when ALL of these hold: the admin setting says live, PLAN_PAYMENTS_LIVE_ENABLED is "true", and the live keys of the
 * chosen gateway are present. Key values are read here, handed to the adapter, and never logged, returned or stored.
 */
export function buildLiveGateway(name: GatewayName, env: Record<string, string | undefined>): PaymentGatewayPort | null {
  if (env.PLAN_PAYMENTS_LIVE_ENABLED !== 'true') return null;
  if (name === 'razorpay') {
    const keyId = env.RAZORPAY_LIVE_KEY_ID; const keySecret = env.RAZORPAY_LIVE_KEY_SECRET; const webhookSecret = env.RAZORPAY_LIVE_WEBHOOK_SECRET;
    if (!keyId || !keySecret || !webhookSecret || !keyId.startsWith('rzp_live_')) return null;
    return new RazorpayGateway(new RazorpayTestAdapter({ keyId, keySecret, webhookSecret }, undefined, 'live'), 'live');
  }
  const appId = env.CASHFREE_LIVE_APP_ID; const secretKey = env.CASHFREE_LIVE_SECRET_KEY;
  return appId && secretKey ? new CashfreeGateway({ appId, secretKey }, 'live') : null;
}
