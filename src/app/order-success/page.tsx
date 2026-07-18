import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle, Rocket, ArrowRight, Clock, Mail } from 'lucide-react';
import Button from '@/components/ui/Button';
import { createPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = createPageMetadata({
  title: 'Order Success',
  description: 'Your order has been confirmed. Our team is already working on your website.',
  path: '/order-success',
});

export default function OrderSuccessPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-primary-50/50 via-white to-white">
      <header className="pt-8 px-5">
        <div className="container-mx">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-primary-500 shadow-md">
              <Rocket className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">
              Get4<span className="text-primary-600">Domain</span>
            </span>
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-lg text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-success-100 animate-scale-in">
            <CheckCircle className="h-10 w-10 text-success-600" />
          </div>

          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Order Confirmed!</h1>
          <p className="mt-3 text-slate-600">Thank you for your purchase. Your order has been received and our team is already working on your website.</p>

          <div className="mt-8 card-base p-6 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs text-slate-400">Order Number</p>
                <p className="text-sm font-bold text-slate-900">#G4D-2026-0042</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Amount Paid</p>
                <p className="text-sm font-bold text-primary-600">₹11,856</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50"><Clock className="h-4 w-4 text-primary-600" /></div>
                <div><p className="text-sm font-medium text-slate-900">Estimated Launch Time</p><p className="text-xs text-slate-500">Within 24 hours</p></div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary-50"><Mail className="h-4 w-4 text-secondary-600" /></div>
                <div><p className="text-sm font-medium text-slate-900">Confirmation Email Sent</p><p className="text-xs text-slate-500">Check your inbox for next steps</p></div>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl bg-primary-50 p-4 text-left">
            <p className="text-sm font-semibold text-primary-700">What happens next?</p>
            <ol className="mt-2 space-y-1.5 text-sm text-slate-600">
              <li>1. Check your email for order confirmation and instructions</li>
              <li>2. Upload your logo and business details via the dashboard</li>
              <li>3. Our team builds and deploys your website within 24 hours</li>
              <li>4. You&apos;ll receive an email when your website goes live</li>
            </ol>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row justify-center">
            <Link href="/"><Button size="lg" variant="outline">Back to Home</Button></Link>
            <Link href="/support"><Button size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>Track Your Order</Button></Link>
          </div>
        </div>
      </div>
    </div>
  );
}
