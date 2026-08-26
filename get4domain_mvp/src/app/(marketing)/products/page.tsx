import { redirect } from 'next/navigation';

// The Products page/section has been replaced by the single Features page.
export default function ProductsPage() {
  redirect('/features');
}
