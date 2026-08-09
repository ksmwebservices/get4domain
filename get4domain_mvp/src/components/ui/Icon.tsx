import { type ComponentType } from 'react';
import * as LucideIcons from 'lucide-react';
import { type LucideProps } from 'lucide-react';

/**
 * Renders a lucide-react icon by its string name (as stored in industry
 * configs, e.g. "CalendarCheck"). Falls back to a Circle if the name is unknown.
 */
export default function Icon({ name, ...props }: { name: string } & LucideProps) {
  const registry = LucideIcons as unknown as Record<string, ComponentType<LucideProps>>;
  const Cmp = registry[name] ?? LucideIcons.Circle;
  return <Cmp {...props} />;
}
