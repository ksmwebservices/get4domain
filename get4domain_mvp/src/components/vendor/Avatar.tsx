interface AvatarProps {
  name: string;
  tone?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

const sizes = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
};

export function Avatar({ name, tone = 'bg-brand-600', size = 'sm' }: AvatarProps) {
  const initials = name
    .replace(/[+•\d\s]/g, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();
  return (
    <div className={`${tone} ${sizes[size]} rounded-full flex items-center justify-center font-bold text-white shrink-0 ring-2 ring-ink-900/50`}>
      {initials || '?'}
    </div>
  );
}

export default Avatar;
