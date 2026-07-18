import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import { createPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = createPageMetadata({
  title: 'Privacy Policy',
  description: 'How Get4Domain collects, uses, and safeguards your personal information.',
  path: '/privacy-policy',
});

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      breadcrumb="Privacy Policy"
      lastUpdated="January 2026"
      sections={[
        {
          heading: '1. Introduction',
          content: (
            <>
              <p>Get4Domain ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your personal information when you use our platform and services.</p>
              <p>By using Get4Domain, you agree to the collection and use of information in accordance with this policy.</p>
            </>
          ),
        },
        {
          heading: '2. Information We Collect',
          content: (
            <>
              <p>We collect the following types of information:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Personal Information:</strong> Name, email address, phone number, and business details you provide during registration or checkout.</li>
                <li><strong>Payment Information:</strong> Billing details processed securely through our payment partners. We do not store card numbers.</li>
                <li><strong>Business Information:</strong> Business name, address, logo, and content you upload for website deployment.</li>
                <li><strong>Technical Data:</strong> IP address, browser type, and usage data collected automatically.</li>
              </ul>
            </>
          ),
        },
        {
          heading: '3. How We Use Your Information',
          content: (
            <>
              <p>We use your information to:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Deploy and maintain your business website</li>
                <li>Process payments and send order confirmations</li>
                <li>Provide customer support and respond to inquiries</li>
                <li>Send important updates about your account and services</li>
                <li>Improve our platform and develop new features</li>
                <li>Comply with legal obligations</li>
              </ul>
            </>
          ),
        },
        {
          heading: '4. Data Sharing',
          content: (
            <>
              <p>We do not sell your personal information. We may share your data with trusted third-party service providers who help us operate our platform (such as payment processors, hosting providers, and domain registrars). These providers are bound by confidentiality obligations.</p>
              <p>We may also disclose information when required by law or to protect our rights and safety.</p>
            </>
          ),
        },
        {
          heading: '5. Data Security',
          content: (<p>We implement appropriate technical and organizational measures to protect your personal information, including SSL encryption, secure servers, and restricted access controls. However, no method of transmission over the internet is 100% secure.</p>),
        },
        {
          heading: '6. Your Rights',
          content: (
            <>
              <p>You have the right to:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Access your personal data</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Opt out of marketing communications</li>
                <li>Withdraw consent at any time</li>
              </ul>
              <p>To exercise these rights, contact us at support@get4domain.in</p>
            </>
          ),
        },
        {
          heading: '7. Cookies',
          content: (<p>We use cookies and similar technologies to enhance your browsing experience, analyze traffic, and understand user behavior. You can control cookies through your browser settings.</p>),
        },
        {
          heading: '8. Contact Us',
          content: (<p>If you have questions about this Privacy Policy, please contact us at support@get4domain.in or call +91 98765 43210.</p>),
        },
      ]}
    />
  );
}
