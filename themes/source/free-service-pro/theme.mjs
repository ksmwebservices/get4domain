import { makePalette } from '../../lib/preset-build.mjs';
import presets from './presets.mjs';

// Service Pro: Handyman (home services and auto services). Trust first, warm, practical, high contrast.
export default {
  id: 'free-service-pro',
  name: 'Service Pro',
  description: 'For plumbers, electricians, repair and cleaning trades and garages: phone number first, an emergency or same-day badge, service areas, a clear price list, before and after, and licence or certificate details. Warm, practical, high contrast.',
  tier: 'Standard',
  tracks: ['handyman'],
  families: ['home-services', 'auto-services'],
  palette: makePalette({ h: 24, s: 0.85, accentShift: 20 }),
  fonts: { heading: 'Montserrat', body: 'Work Sans' },
  radius: '6px',
  presets,
};
