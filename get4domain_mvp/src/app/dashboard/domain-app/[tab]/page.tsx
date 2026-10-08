'use client';

import { useParams } from 'next/navigation';
import DomainAppTab from '@/domainapp/DomainAppTab';

export default function DomainAppTabPage() {
  const params = useParams();
  return <DomainAppTab tabKey={String(params.tab)} />;
}
