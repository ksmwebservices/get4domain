'use client';

import ChatWidget from './ChatWidget';

const QUICK_REPLIES = [
  'What is DomainApp?',
  'What is DomainCampaign?',
  'View Pricing',
  'Book a Demo',
  'Talk to a human',
];

export default function ChatBot() {
  return (
    <ChatWidget
      context="marketing"
      position="left"
      title="Get4Domain Assistant"
      subtitle="Typically replies instantly"
      greeting="Hi! I'm the Get4Domain assistant. How can I help you today?"
      quickReplies={QUICK_REPLIES}
    />
  );
}
