import type { LegalDocDef } from '../legal-meta';

/** Refund and Cancellation Policy. Plain-language DRAFT for review. Applies the OWNER DEFAULTS of dispatch D2 (no refund once a plan is active, three exceptions, no part refund); a lawyer in India refines it later (docs/v3/LEGAL_REVIEW.md). */
export const REFUND: LegalDocDef = {
  path: '/refund-policy',
  title: 'Refund and Cancellation Policy',
  metaTitle: 'Refund and Cancellation Policy',
  metaDescription: 'How refunds and cancellations work at Get4Domain: plan fees, failed and held payments, the prepaid wallet, cash payments and how to ask for help.',
  intro: 'This policy explains refunds and cancellations for Get4Domain, which is operated by KSM QUANTUM TECHNOLOGIES. It applies together with our Terms of Service and our Payments and Billing page.',
  showGrievance: true,
  sections: [
    {
      id: 'how-you-pay',
      heading: 'How you pay',
      paragraphs: [
        'You pay for plans only through an online payment gateway, Razorpay or Cashfree. Prices are shown without GST, and GST is added at checkout. We issue an invoice after a successful payment.',
        'No discounts, coupons or offers exist. The amount shown at checkout is the amount to pay.',
      ],
    },
    {
      id: 'cancelling',
      heading: 'Cancelling your plan',
      paragraphs: [
        'You can stop renewing your plan at any time. Your access continues until the end of the term you have paid for.',
        'There is no part refund for the unused part of a term. Stopping renewal does not by itself entitle you to a refund.',
      ],
    },
    {
      id: 'plan-fee-refunds',
      heading: 'Refunds of plan fees',
      paragraphs: [
        'A payment for a plan is not refundable once the plan is active.',
        'There are three exceptions. One is a duplicate payment. Another is a payment that was taken but did not activate a plan. The last is a payment whose amount did not match the order and was held.',
        'For an exception, an administrator of Get4Domain first checks the payment gateway record. Where a refund is due, it is made through the payment gateway to the original payment method. We do not refund by cash, and we do not refund to a different account.',
        'GST and invoices connected with a refund are handled as the Central Goods and Services Tax Act and its rules require.',
      ],
    },
    {
      id: 'failed-and-cancelled-orders',
      heading: 'Failed and cancelled orders',
      paragraphs: [
        'A failed or cancelled order does not start a plan. If money was taken for such an order, or if you paid and no plan was activated, please contact us with the payment reference. An administrator checks the payment gateway record, and any refund goes through the payment gateway to the original payment method.',
        'If you paid twice for the same order, the repeat payment is a duplicate and is dealt with in the same way.',
      ],
    },
    {
      id: 'held-payments',
      heading: 'Payments held for review',
      paragraphs: [
        'A payment that does not match the order, for example an amount that differs from the order, is held for review. We do not start a plan until the review is done.',
        'An administrator checks the payment gateway record. If the payment cannot be accepted, the amount is refunded through the payment gateway to the original payment method.',
      ],
    },
    {
      id: 'wallet',
      heading: 'The wallet',
      paragraphs: [
        'The wallet holds prepaid platform credit. Wallet balance is not refundable and cannot be taken out as cash.',
        'If a charge on the wallet fails on our side and we reverse it, the credit goes back to your wallet. This is not a refund.',
      ],
    },
    {
      id: 'cash-payments',
      heading: 'Cash payments',
      paragraphs: [
        'A cash payment is accepted only when an administrator of Get4Domain confirms it. Anything to be returned on a cash payment is agreed with that administrator in writing.',
      ],
    },
    {
      id: 'how-to-ask',
      heading: 'How to ask for help',
      paragraphs: [
        'To ask about a refund or a cancellation, use the details on our Contact page. Please give your account email, the payment reference and the invoice number if you have one.',
        'We look at each request and reply as soon as we reasonably can. After a refund is started, the time it takes to reach you depends on the payment gateway and your bank.',
        'If you are not satisfied with our reply, you can write to our grievance officer. The details are on this page and on our Contact page when they are set.',
      ],
    },
    {
      id: 'your-rights',
      heading: 'Your legal rights',
      paragraphs: [
        'Nothing in this policy limits a right you have under the law, including your rights as a consumer under the Consumer Protection (E-Commerce) Rules.',
      ],
    },
    {
      id: 'laws-and-courts',
      heading: 'Governing law and courts',
      paragraphs: [
        'This policy is governed by the laws of India. The courts at Chennai, Tamil Nadu have exclusive jurisdiction over any dispute about it.',
      ],
    },
  ],
};
