'use client';

import { FileText } from 'lucide-react';
import { DocList } from './Invoices';

/** Quotes: send a price, mark it accepted, turn it into an invoice in one tap. Same screen on every plan. */
export default function Quotes() {
  return (
    <div className="mx-auto max-w-5xl space-y-4 py-2">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><FileText className="h-6 w-6 text-primary-600" /> Quotes</h1>
        <p className="mt-1 text-sm text-slate-500">Send a customer a price. When they say yes, make the invoice from the quote and nothing is typed twice.</p>
      </div>
      <DocList type="QUOTE" />
    </div>
  );
}
