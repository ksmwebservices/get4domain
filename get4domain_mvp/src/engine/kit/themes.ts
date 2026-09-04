import type { ThemeTokens } from '../types';

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";

/**
 * One distinct theme per main industry — deliberately spread across light/dark,
 * serif/sans, sharp/rounded and different colour families so no two industries read
 * the same. Sub-categories inherit their parent industry's theme (content varies only).
 */
export const THEMES: Record<string, ThemeTokens> = {
  // Appointment / practitioner
  clinic:     { bg: '#F7FAFC', fg: '#0F2A33', surface: '#FFFFFF', border: 'rgba(13,148,136,0.16)', muted: '#5B7078', accent: '#0D9488', accentFg: '#FFFFFF', accent2: '#38BDF8', fontDisplay: SANS, fontBody: SANS, radius: '12px', mode: 'light' },
  salon:      { bg: '#171018', fg: '#F6ECEF', surface: '#211722', border: 'rgba(212,165,165,0.18)', muted: '#B49AA6', accent: '#D9A3A8', accentFg: '#171018', accent2: '#C08457', fontDisplay: SERIF, fontBody: SANS, radius: '4px', mode: 'dark' },
  gym:        { bg: '#0C0E0B', fg: '#F1F5E8', surface: '#161A12', border: 'rgba(163,230,53,0.18)', muted: '#9AA487', accent: '#A3E635', accentFg: '#0C0E0B', accent2: '#F97316', fontDisplay: SANS, fontBody: SANS, radius: '2px', mode: 'dark' },
  coaching:   { bg: '#FBF8F3', fg: '#1E1B2E', surface: '#FFFFFF', border: 'rgba(79,70,229,0.14)', muted: '#6B6780', accent: '#4F46E5', accentFg: '#FFFFFF', accent2: '#F59E0B', fontDisplay: SANS, fontBody: SANS, radius: '12px', mode: 'light' },
  education:  { bg: '#FFFFFF', fg: '#12213B', surface: '#F4F7FB', border: 'rgba(37,99,235,0.14)', muted: '#5A6B85', accent: '#2563EB', accentFg: '#FFFFFF', accent2: '#F59E0B', fontDisplay: SERIF, fontBody: SANS, radius: '10px', mode: 'light' },
  professional:{ bg: '#FAFAF9', fg: '#1C2536', surface: '#FFFFFF', border: 'rgba(28,37,54,0.12)', muted: '#5C6675', accent: '#1E3A5F', accentFg: '#FFFFFF', accent2: '#B08D57', fontDisplay: SERIF, fontBody: SANS, radius: '3px', mode: 'light' },
  finance:    { bg: '#0B1220', fg: '#EAF0F7', surface: '#121C2E', border: 'rgba(201,162,75,0.20)', muted: '#8FA0B5', accent: '#C9A24B', accentFg: '#0B1220', accent2: '#3B82F6', fontDisplay: SERIF, fontBody: SANS, radius: '4px', mode: 'dark' },
  diagnostics:{ bg: '#F5FBFE', fg: '#0B2740', surface: '#FFFFFF', border: 'rgba(6,140,190,0.16)', muted: '#557089', accent: '#0891B2', accentFg: '#FFFFFF', accent2: '#22C55E', fontDisplay: SANS, fontBody: SANS, radius: '8px', mode: 'light' },
  photography:{ bg: '#0A0A0A', fg: '#F4F4F4', surface: '#141414', border: 'rgba(255,255,255,0.14)', muted: '#9A9A9A', accent: '#E4B34A', accentFg: '#0A0A0A', accent2: '#F4F4F4', fontDisplay: SANS, fontBody: SANS, radius: '0px', mode: 'dark' },

  // Hospitality / booking
  hotel:      { bg: '#F6F1E9', fg: '#1B2B2A', surface: '#FFFFFF', border: 'rgba(15,76,74,0.16)', muted: '#5E6E68', accent: '#0F4C4A', accentFg: '#F6F1E9', accent2: '#B08D57', fontDisplay: SERIF, fontBody: SANS, radius: '6px', mode: 'light' },
  events:     { bg: '#1A1022', fg: '#F3E9F5', surface: '#241631', border: 'rgba(224,190,120,0.20)', muted: '#B29CC0', accent: '#E0BE78', accentFg: '#1A1022', accent2: '#C15C8A', fontDisplay: SERIF, fontBody: SANS, radius: '8px', mode: 'dark' },
  travel:     { bg: '#F3FBFC', fg: '#0B3B47', surface: '#FFFFFF', border: 'rgba(6,148,162,0.16)', muted: '#4F7982', accent: '#0694A2', accentFg: '#FFFFFF', accent2: '#FB7185', fontDisplay: SANS, fontBody: SANS, radius: '16px', mode: 'light' },

  // Commerce / catalogue
  restaurant: { bg: '#181310', fg: '#F5EDE2', surface: '#221A15', border: 'rgba(214,158,92,0.20)', muted: '#B39F8B', accent: '#D69E5C', accentFg: '#181310', accent2: '#B44C2E', fontDisplay: SERIF, fontBody: SANS, radius: '4px', mode: 'dark' },
  retail:     { bg: '#FFFFFF', fg: '#1A1030', surface: '#F7F5FB', border: 'rgba(124,58,237,0.14)', muted: '#645C78', accent: '#7C3AED', accentFg: '#FFFFFF', accent2: '#EC4899', fontDisplay: SANS, fontBody: SANS, radius: '14px', mode: 'light' },
  agriculture:{ bg: '#F7F6EE', fg: '#20301A', surface: '#FFFFFF', border: 'rgba(77,124,15,0.16)', muted: '#5E6B4E', accent: '#4D7C0F', accentFg: '#FFFFFF', accent2: '#B45309', fontDisplay: SERIF, fontBody: SANS, radius: '10px', mode: 'light' },
  automobile: { bg: '#0D0F12', fg: '#EEF2F6', surface: '#161A1F', border: 'rgba(56,132,255,0.20)', muted: '#8B96A3', accent: '#3B82F6', accentFg: '#FFFFFF', accent2: '#EF4444', fontDisplay: SANS, fontBody: SANS, radius: '2px', mode: 'dark' },

  // Project / portfolio / B2B
  construction:{ bg: '#F5F5F4', fg: '#1C1917', surface: '#FFFFFF', border: 'rgba(28,25,23,0.14)', muted: '#57534E', accent: '#EA8A0B', accentFg: '#1C1917', accent2: '#1C1917', fontDisplay: SANS, fontBody: SANS, radius: '2px', mode: 'light' },
  technology: { bg: '#0A0B14', fg: '#ECEEF7', surface: '#12131F', border: 'rgba(139,92,246,0.20)', muted: '#8B8FA8', accent: '#8B5CF6', accentFg: '#FFFFFF', accent2: '#22D3EE', fontDisplay: SANS, fontBody: SANS, radius: '8px', mode: 'dark' },
  logistics:  { bg: '#F6F8FA', fg: '#0F1E2E', surface: '#FFFFFF', border: 'rgba(15,30,46,0.12)', muted: '#5A6A7A', accent: '#1D4ED8', accentFg: '#FFFFFF', accent2: '#F97316', fontDisplay: SANS, fontBody: SANS, radius: '6px', mode: 'light' },
};
