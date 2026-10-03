import { Users, MessageCircle, Receipt, UserCog, Boxes, Bot, Search, MapPin, Link2, Share2, Smartphone, Palette, type LucideIcon } from 'lucide-react';

/** lucide icon for each CAPABILITIES[].icon name (data/platform-features.ts). */
export const CAPABILITY_ICONS: Record<string, LucideIcon> = {
  Users, MessageCircle, Receipt, UserCog, Boxes, Bot, Search, MapPin, Link2, Share2, Smartphone, Palette,
};

/** Rotating gradient accents so a grid of 12 cards does not read as one colour. */
export const CAPABILITY_ACCENTS = [
  'from-primary-400 to-primary-600', 'from-warning-400 to-warning-600', 'from-success-400 to-success-600',
  'from-secondary-400 to-secondary-600',
];
