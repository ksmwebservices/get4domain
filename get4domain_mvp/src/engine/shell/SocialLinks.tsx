import { Facebook, Instagram, Link as LinkIcon, Linkedin, MapPin, MessageCircle, Youtube } from 'lucide-react';
import type { ShellSocial } from './types';
import { SOCIAL_LABEL } from './types';

/** The social icons of a site: only links the vendor filled in are drawn, so an empty link hides its icon. No script. */
const XIcon = ({ className }: { className?: string }) => <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>;
const ICONS: Record<string, (p: { className?: string }) => React.ReactElement> = {
  instagram: (p) => <Instagram {...p} />, facebook: (p) => <Facebook {...p} />, youtube: (p) => <Youtube {...p} />, linkedin: (p) => <Linkedin {...p} />, x: XIcon,
  whatsapp: (p) => <MessageCircle {...p} />, maps: (p) => <MapPin {...p} />, custom: (p) => <LinkIcon {...p} />,
};

export function SocialLinks({ social, className = '', size = 'h-5 w-5' }: { social: ShellSocial; className?: string; size?: string }) {
  const keys = (['instagram', 'facebook', 'youtube', 'whatsapp', 'linkedin', 'x', 'maps', 'custom'] as const).filter((k) => !!social[k]);
  if (keys.length === 0) return null;
  return (
    <ul className={`flex flex-wrap items-center gap-2 ${className}`} aria-label="Social links">
      {keys.map((k) => {
        const Icon = ICONS[k];
        const name = k === 'custom' ? (social.customLabel || 'Link') : SOCIAL_LABEL[k];
        return <li key={k}><a href={social[k]} target="_blank" rel="noopener noreferrer" aria-label={name} title={name} data-g4d-social={k} className="flex h-11 w-11 items-center justify-center border border-[var(--sh-border)] text-[var(--sh-fg)] hover:text-[var(--sh-accent)]" style={{ borderRadius: 'var(--sh-radius)' }}><Icon className={size} /></a></li>;
      })}
    </ul>
  );
}
