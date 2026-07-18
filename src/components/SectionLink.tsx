import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface SectionLinkProps {
  to: string;
  label?: string;
}

export default function SectionLink({ to, label = 'Explore' }: SectionLinkProps) {
  return (
    <div className="mt-10 flex justify-center">
      <Link
        href={to}
        className="group inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-primary-300 hover:text-primary-600 hover:shadow-md"
      >
        {label}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}
