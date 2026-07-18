'use client';

import ChatWidget from './ChatWidget';

const QUICK_REPLIES = [
  'How do I pay an invoice?',
  'How do I update my website?',
  'How do I add a product?',
  'Talk to a human',
];

interface DashboardChatBotProps {
  vendorName?: string;
  industry?: string;
}

export default function DashboardChatBot({ vendorName, industry }: DashboardChatBotProps) {
  const firstName = vendorName?.split(' ')[0];

  return (
    <ChatWidget
      context="dashboard"
      position="right"
      title="Get4Domain Support"
      subtitle="Mon-Sat, 9am-8pm IST"
      greeting={`Hi${firstName ? ` ${firstName}` : ''}! Need help with your account? Ask me anything or pick an option below.`}
      quickReplies={QUICK_REPLIES}
      vendorName={vendorName}
      industry={industry}
    />
  );
}
