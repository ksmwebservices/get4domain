'use client';

import { Lock } from 'lucide-react';
import Modal from './ui/Modal';
import Button from './ui/Button';

interface AdminAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: string;
}

/**
 * Admin-platform equivalent of the vendor UpgradeModal. Shown when a
 * Marketing/Operations staff member clicks a section outside their role.
 * Same locked-tab pattern — only the copy differs (no upgrade CTA).
 */
export default function AdminAccessModal({ isOpen, onClose, feature }: AdminAccessModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50">
          <Lock className="h-6 w-6 text-primary-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-900">{feature} is restricted</h3>
        <p className="mt-2 text-sm text-slate-500">
          You don&apos;t have access to this section. Contact your Super Admin if you need it.
        </p>
        <div className="mt-6">
          <Button fullWidth onClick={onClose}>Got it</Button>
        </div>
      </div>
    </Modal>
  );
}
