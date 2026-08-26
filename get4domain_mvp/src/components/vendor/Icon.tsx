import * as Icons from 'lucide-react';
import type { LucideProps } from 'lucide-react';

/**
 * String-name → lucide-react icon (kept from the Bolt reference so data files can
 * carry icon names as plain strings). Falls back to a Square if the name is unknown.
 */
export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const Cmp = (Icons as unknown as Record<string, React.ComponentType<LucideProps>>)[name];
  if (!Cmp) return <Icons.Square {...props} />;
  return <Cmp {...props} />;
}

export default Icon;
