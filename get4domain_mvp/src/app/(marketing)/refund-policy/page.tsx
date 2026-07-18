import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import { createPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = createPageMetadata({
  title: 'Refund Policy',
  description: 'Our refund policy and guarantee for Get4Domain services.',
  path: '/refund-policy',
});

export default function RefundPolicyPage() {
  return (
    <LegalPage
      title="Refund Policy"
      breadcrumb="Refund Policy"
      lastUpdated="January 2026"
      sections={[
        { heading: '1. Our Commitment', content: (<p>At Get4Domain, we are committed to your satisfaction. We stand behind our service with a clear refund policy to ensure you can purchase with confidence.</p>) },
        {
          heading: '2. Full Refund Guarantee',
          content: (
            <>
              <p>We offer a <strong>full refund</strong> if we fail to deploy your website within 24 hours of receiving all required information and payment. Required information includes:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Completed business details form</li>
                <li>Business logo (or confirmation to use text-based logo)</li>
                <li>Preferred domain name (with alternatives)</li>
                <li>Any additional content or images requested</li>
              </ul>
            </>
          ),
        },
        {
          heading: '3. Refund Eligibility',
          content: (
            <>
              <p><strong>Eligible for refund:</strong></p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Website not deployed within 24 hours (due to our delay)</li>
                <li>Service not started after payment and information received</li>
                <li>Duplicate payment for the same service</li>
              </ul>
              <p className="mt-3"><strong>Not eligible for refund:</strong></p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Website has been deployed and is live</li>
                <li>Delay caused by incomplete or incorrect information from the customer</li>
                <li>Domain name unavailable after registration attempt</li>
                <li>Change of mind after website deployment</li>
                <li>Add-on services that have been executed or are in progress</li>
              </ul>
            </>
          ),
        },
        {
          heading: '4. Refund Process',
          content: (
            <>
              <p>To request a refund:</p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Email support@get4domain.com with your order number</li>
                <li>Provide the reason for your refund request</li>
                <li>Our team will review within 48 hours</li>
                <li>Approved refunds are processed within 5-7 business days</li>
                <li>Refunds are credited to the original payment method</li>
              </ol>
            </>
          ),
        },
        { heading: '5. Domain & Hosting', content: (<p>If a domain has already been registered on your behalf, the domain registration fee (₹500-₹1,000) is non-refundable. You will retain ownership of the domain and can transfer it to another provider.</p>) },
        { heading: '6. Add-on Services', content: (<p>Add-on services (SEO, social media, content writing, etc.) are eligible for refund only if the service has not been started. Once work has begun, the service is non-refundable.</p>) },
        { heading: '7. Partial Refunds', content: (<p>In certain cases, partial refunds may be offered at our discretion — for example, if only some components of a package were delivered. Partial refund amounts are determined on a case-by-case basis.</p>) },
        { heading: '8. Contact Us', content: (<p>For refund requests or questions about this policy, contact us at support@get4domain.com or call +91 98765 43210. Our support team is available Monday to Saturday, 9:00 AM - 8:00 PM IST.</p>) },
      ]}
    />
  );
}
