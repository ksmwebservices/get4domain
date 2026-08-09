'use client';

import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';

/**
 * Placeholder for dashboardTabs backed by addons whose backend isn't built yet
 * (fleet, drivers, tables, etc.). Per dispatch: show a "Coming Soon / contact
 * support" state rather than blocking the batch.
 */
export default function ComingSoon({ label, icon }: { label: string; icon: string }) {
  return (
    <Card className="mx-auto mt-10 max-w-lg text-center" padded>
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50">
        <Icon name={icon} className="h-6 w-6 text-primary-600" />
      </div>
      <h2 className="text-lg font-bold text-slate-900">{label}</h2>
      <p className="mt-2 text-sm text-slate-500">
        {label} is an add-on module. It&apos;s enabled on your plan but the workspace is
        being finished — contact support to get set up in the meantime.
      </p>
      <div className="mt-5">
        <a href="/dashboard/support"><Button variant="outline">Contact Support</Button></a>
      </div>
    </Card>
  );
}
