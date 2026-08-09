'use client';

import Link from 'next/link';
import { Lock, Sparkles, Wallet, CalendarCheck } from 'lucide-react';
import Modal from './ui/Modal';
import Button from './ui/Button';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: string;
  requiredModule: string;
  /** wallet-type features prompt a top-up; plan features prompt a demo. */
  kind?: 'wallet' | 'plan';
}

/**
 * Shown when a vendor clicks a locked (plan/addon-gated) tab. Contextual copy +
 * CTA: wallet top-up for usage-based features, "Book a Demo" for plan features.
 */
export default function UpgradeModal({
  isOpen,
  onClose,
  feature,
  requiredModule,
  kind = 'plan',
}: UpgradeModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50">
          <Lock className="h-6 w-6 text-primary-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-900">{feature} is locked</h3>
        <p className="mt-2 text-sm text-slate-500">
          {kind === 'wallet'
            ? `${feature} runs on your wallet. Top up to start using it right away.`
            : `${feature} is part of the ${requiredModule} module and isn't active on your current plan yet.`}
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          {kind === 'wallet' ? (
            <Link href="/dashboard/wallet">
              <Button fullWidth leftIcon={<Wallet className="h-4 w-4" />} onClick={onClose}>
                Top Up Wallet
              </Button>
            </Link>
          ) : (
            <Link href="/#contact">
              <Button fullWidth leftIcon={<CalendarCheck className="h-4 w-4" />} onClick={onClose}>
                Book a Demo
              </Button>
            </Link>
          )}
          <Link href="/pricing">
            <Button fullWidth variant="outline" leftIcon={<Sparkles className="h-4 w-4" />} onClick={onClose}>
              Learn More
            </Button>
          </Link>
        </div>
      </div>
    </Modal>
  );
}
