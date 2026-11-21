import type { LegalDocDef } from '../legal-meta';

/** Payments and Billing. Plain-language DRAFT for review. Only decided facts plus the OWNER DEFAULTS of dispatch D2: gateway only, GST on top as its own line, invoice after payment, held and failed payments, no part refund, wallet, cash only when confirmed, no discounts. */
export const PAYMENTS: LegalDocDef = {
  path: '/payments-and-billing',
  title: 'Payments and Billing',
  metaTitle: 'Payments and Billing',
  metaDescription: 'How you pay for Get4Domain: online payment gateway only, billing terms, GST added at checkout, invoices, failed and held payments and the prepaid wallet.',
  intro: 'This page explains how payment works on Get4Domain, which is operated by KSM QUANTUM TECHNOLOGIES. It is part of our Terms of Service.',
  sections: [
    {
      id: 'payment-gateway',
      heading: 'Payment through a gateway only',
      paragraphs: [
        'Plans are paid for only through an online payment gateway, Razorpay or Cashfree. Payment is started from your business account and completed through the gateway.',
        'This website does not ask for card, UPI or bank details, and we do not store them. Please never send such details to us by email or message.',
        'The only other way to pay is cash that an administrator of Get4Domain has confirmed.',
      ],
    },
    {
      id: 'billing-terms',
      heading: 'Plans and billing terms',
      paragraphs: [
        'Plans are billed quarterly, half-yearly or annually. You choose the billing term at checkout and see the price for it before you pay.',
        'You can stop renewing at any time. Your access continues until the end of the term you have paid for. There is no part refund for the unused part of a term.',
      ],
    },
    {
      id: 'gst',
      heading: 'GST',
      paragraphs: [
        'Prices on Get4Domain are shown without GST. GST at the rate in force is added on top at checkout and shown as its own line, and the total is shown before you pay. GST is charged as the Central Goods and Services Tax Act and its rules require.',
      ],
    },
    {
      id: 'invoices',
      heading: 'Invoices',
      paragraphs: [
        'We issue an invoice after a successful payment. The invoice shows the plan, the price, the GST as its own line and the total. It shows our tax registration details where we have them.',
      ],
    },
    {
      id: 'failed-payments',
      heading: 'Failed and cancelled payments',
      paragraphs: [
        'A failed or cancelled order does not start a plan. If money was taken but the order failed or was cancelled, or if you paid and no plan was activated, contact us with the payment reference. An administrator checks the payment gateway record, and any refund goes through the payment gateway to the original payment method.',
        'A repeat payment for the same order is a duplicate and is dealt with in the same way.',
      ],
    },
    {
      id: 'held-payments',
      heading: 'Payments held for review',
      paragraphs: [
        'A payment that does not match the order, for example an amount that differs from the order, is held for review. We do not start a plan until the review is done. An administrator checks the payment gateway record. If the payment cannot be accepted, the amount is refunded through the payment gateway to the original payment method.',
      ],
    },
    {
      id: 'wallet',
      heading: 'The wallet',
      paragraphs: [
        'The wallet holds prepaid platform credit that you add through the payment gateway. It is used for charges on Get4Domain.',
        'Wallet balance is not refundable, cannot be taken out as cash and cannot be transferred. A charge that fails on our side and is reversed returns the credit to your wallet. This is not a refund.',
      ],
    },
    {
      id: 'cash-payments',
      heading: 'Cash payments',
      paragraphs: [
        'Cash is accepted only when an administrator confirms it. A cash payment is not valid until that confirmation is recorded.',
      ],
    },
    {
      id: 'no-discounts',
      heading: 'No discounts',
      paragraphs: [
        'No discounts, coupons or offers exist. The price shown at checkout, plus GST, is the price you pay. Using a partner link does not change the price.',
      ],
    },
    {
      id: 'refunds',
      heading: 'Refunds',
      paragraphs: [
        'A payment for a plan is not refundable once the plan is active. The exceptions are a duplicate payment, a payment that was taken but did not activate a plan, and a payment whose amount did not match the order and was held.',
        'Our Refund and Cancellation Policy explains refunds. Any refund is made through the payment gateway to the original payment method, after an administrator checks the payment gateway record.',
      ],
    },
    {
      id: 'questions',
      heading: 'Questions about a payment',
      paragraphs: [
        'For a question about a payment, an invoice or a charge, use the details on our Contact page and give the payment reference.',
      ],
    },
  ],
};
