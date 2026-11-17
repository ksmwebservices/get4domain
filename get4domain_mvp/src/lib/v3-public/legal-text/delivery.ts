import type { LegalDocDef } from '../legal-meta';

/** Delivery policy for a digital service. Plain-language DRAFT for review. No shipping; activation after payment; no times or numbers. */
export const DELIVERY: LegalDocDef = {
  path: '/delivery-policy',
  title: 'Delivery Policy',
  metaTitle: 'Delivery Policy',
  metaDescription: 'Get4Domain is a digital service. This policy explains how a plan, a trial site and wallet credit are delivered and what happens when a payment does not complete.',
  intro: 'Get4Domain is a digital service operated by KSM QUANTUM TECHNOLOGIES. Nothing is shipped. This policy explains how the service is delivered.',
  sections: [
    {
      id: 'digital-service',
      heading: 'A digital service, no shipping',
      paragraphs: [
        'Get4Domain gives you access to software and a website on your own subdomain. There are no physical goods, no courier and no delivery address. No shipping charge is ever added.',
      ],
    },
    {
      id: 'trial-site',
      heading: 'Trial site',
      paragraphs: [
        'When you register, your trial site is set up and you are taken to your business account, where you can start working on it. A Free trial site is informational. The main features need a paid plan.',
      ],
    },
    {
      id: 'plan-activation',
      heading: 'Plan activation after payment',
      paragraphs: [
        'A paid plan is activated after the payment gateway confirms your payment. When it is active, you can see it in your business account and use its features. The timing is as shown at checkout.',
        'A failed or cancelled order does not activate a plan. A payment that does not match the order is held for review, and the plan starts only after the review is done.',
        'A cash payment activates a plan only when an administrator of Get4Domain has confirmed it.',
      ],
    },
    {
      id: 'wallet-credit',
      heading: 'Wallet credit',
      paragraphs: [
        'Wallet credit is added to your wallet after the payment gateway confirms the payment. It is prepaid platform credit and is used for charges on Get4Domain.',
      ],
    },
    {
      id: 'invoice',
      heading: 'Invoice',
      paragraphs: [
        'We issue an invoice after a successful payment. Prices are shown without GST. GST at the rate in force is added at checkout and shown as its own line.',
      ],
    },
    {
      id: 'if-something-is-missing',
      heading: 'If your plan or credit does not appear',
      paragraphs: [
        'If you paid and your plan or wallet credit does not appear, please contact us using the details on our Contact page. Give your account email and the payment reference. An administrator checks the payment gateway record.',
        'Where a payment was taken but no plan was activated, or a payment cannot be accepted, the amount is refunded through the payment gateway to the original payment method, as our Refund and Cancellation Policy explains.',
      ],
    },
    {
      id: 'availability',
      heading: 'Availability',
      paragraphs: [
        'We work to keep the service available, but we do not promise that it will always run without a break. We make no service-level promise unless it is agreed with you in writing.',
      ],
    },
  ],
};
