import { redirect } from 'next/navigation';

// The old "My DomainApp" index was a hard-coded demo page (MR Travels) that nothing links to; send anyone who finds it to the dashboard home.
export default function DomainAppIndexPage(): never {
  redirect('/dashboard');
}
