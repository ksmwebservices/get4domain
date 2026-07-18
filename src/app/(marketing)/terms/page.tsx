import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import { createPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = createPageMetadata({
  title: 'Terms & Conditions',
  description: 'Terms and conditions for using Get4Domain platform and services.',
  path: '/terms',
});

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      breadcrumb="Terms"
      lastUpdated="January 2026"
      sections={[
        { heading: '1. Acceptance of Terms', content: (<p>By accessing and using Get4Domain&apos;s platform and services, you agree to be bound by these Terms &amp; Conditions. If you do not agree with any part of these terms, you must not use our services.</p>) },
        {
          heading: '2. Services',
          content: (
            <>
              <p>Get4Domain provides the following services:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Ready-to-launch business website deployment within 24 hours</li>
                <li>Domain registration (.in / .co.in), hosting, and SSL certificates</li>
                <li>Industry-specific professional templates</li>
                <li>Digital growth add-on services</li>
                <li>30 days of post-launch support</li>
              </ul>
              <p>Our platform is not a website builder. We do not provide drag-and-drop editors or empty templates. Our team builds and deploys your website based on the selected industry template and your business details.</p>
            </>
          ),
        },
        {
          heading: '3. Pricing & Payment',
          content: (
            <>
              <p>The Business Launch Pack is priced at ₹4,999 (one-time). Add-on services are priced separately. All prices are in Indian Rupees (INR) and inclusive of applicable taxes unless stated otherwise.</p>
              <p>Payment must be made in full before website deployment begins. We accept UPI, credit/debit cards, and net banking.</p>
            </>
          ),
        },
        { heading: '4. Deployment Timeline', content: (<p>We commit to deploying your website within 24 hours of receiving all required information (business details, logo, and domain preference). Delays caused by incomplete information or domain availability issues are not covered by this commitment.</p>) },
        {
          heading: '5. User Responsibilities',
          content: (
            <>
              <p>You agree to:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Provide accurate and complete business information</li>
                <li>Ensure you have the right to use any uploaded content, logos, or images</li>
                <li>Not use the website for illegal or unethical purposes</li>
                <li>Respond to our communications in a timely manner</li>
                <li>Maintain the confidentiality of your account credentials</li>
              </ul>
            </>
          ),
        },
        { heading: '6. Intellectual Property', content: (<p>All templates, designs, and code created by Get4Domain remain our intellectual property. Upon full payment, you receive a license to use the deployed website for your business. You retain ownership of all content, logos, and images you provide.</p>) },
        { heading: '7. Support', content: (<p>The ₹4,999 package includes 30 days of support from the date of deployment. Support covers bug fixes, minor content changes, and technical assistance. Additional support and maintenance are available as add-on services.</p>) },
        { heading: '8. Limitation of Liability', content: (<p>Get4Domain shall not be liable for any indirect, incidental, or consequential damages. Our total liability shall not exceed the amount paid by you for our services.</p>) },
        { heading: '9. Termination', content: (<p>We reserve the right to terminate or suspend services if you violate these Terms. Upon termination, your website may be taken offline unless you migrate to another hosting provider.</p>) },
        { heading: '10. Contact', content: (<p>For questions about these Terms, contact us at support@get4domain.in or call +91 98765 43210.</p>) },
      ]}
    />
  );
}
