'use client';

import { faqs } from '@/data/content';
import { SectionHeading } from './ui/Accordion';
import AccordionComponent from './ui/Accordion';

interface FAQProps {
  limit?: number;
}

export default function FAQ({ limit }: FAQProps) {
  const items = limit ? faqs.slice(0, limit) : faqs;

  return (
    <section id="faq">
      <div className="container-mx container-px">
        <SectionHeading
          eyebrow="FAQ"
          title="Common Questions"
          description="Everything you need to know about Get4Domain, DomainApp and DomainCampaign."
        />
        <div className="mx-auto max-w-3xl">
          <AccordionComponent
            items={items.map((faq) => ({
              id: faq.id,
              question: faq.question,
              answer: faq.answer,
            }))}
          />
        </div>
      </div>
    </section>
  );
}
