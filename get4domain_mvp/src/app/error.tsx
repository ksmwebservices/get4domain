'use client';

import Link from 'next/link';
import { Rocket } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-5">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-error-50">
          <Rocket className="h-8 w-8 text-error-500" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Something went wrong</h1>
        <p className="mt-3 text-sm text-slate-600">
          An unexpected error occurred. Please try again.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row justify-center">
          <Button size="lg" onClick={reset}>
            Try Again
          </Button>
          <Link href="/">
            <Button size="lg" variant="outline">
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
