// Category presets for Service Pro (13 Handyman categories). Each row is a design seed: hue, saturation, accent shift, font pair, hero pattern,
// extra-block order, and what is hidden or moved by default. buildPreset turns it into a contrast-checked preset; the JSON is what the package carries.
import { buildPreset } from '../../lib/preset-build.mjs';
import { presetsFrom } from '../shared/preset-content.mjs';

const FAQS = {
  en: [
    { q: 'Do you give a price before you start?', a: 'Yes. We tell you the price first and start only after you agree.' },
    { q: 'Which areas do you cover?', a: 'We cover your city and the areas around it. Call us to confirm your street.' },
    { q: 'Can you come the same day for urgent {label} work?', a: 'For urgent jobs we try to reach you the same day. Call us or message us on WhatsApp.' },
    { q: 'How do I pay?', a: 'By UPI, cash or bank transfer, after the work is done and you are happy with it.' },
  ],
  ta: [
    { q: 'வேலையைத் தொடங்கும் முன் விலை சொல்வீர்களா?', a: 'ஆம். முதலில் விலை சொல்வோம், நீங்கள் ஒப்புக்கொண்ட பின்தான் தொடங்குவோம்.' },
    { q: 'எந்தெந்த பகுதிகளில் சேவை செய்கிறீர்கள்?', a: 'உங்கள் நகரத்திலும் அருகிலுள்ள பகுதிகளிலும். உங்கள் தெருவை உறுதிப்படுத்த அழையுங்கள்.' },
    { q: 'அவசர {label} வேலைக்கு அதே நாள் வர முடியுமா?', a: 'அவசர வேலைகளுக்கு அதே நாள் வர முயற்சிப்போம். அழையுங்கள் அல்லது வாட்ஸ்அப்பில் செய்தி அனுப்புங்கள்.' },
    { q: 'எப்படிப் பணம் செலுத்துவது?', a: 'வேலை முடிந்து நீங்கள் திருப்தி அடைந்த பின் UPI, ரொக்கம் அல்லது வங்கிப் பரிமாற்றம் மூலம்.' },
  ],
};

const MB = ['Montserrat', 'Work Sans'];
const TABLE = {
  plumber: { h: 205, s: 0.8, accentShift: 28, fonts: MB, pattern: 'waves', blocks: 'keep', hidden: ['stats'], order: ['highlights'] },
  electrician: { h: 42, s: 0.85, accentShift: 22, fonts: ['Poppins', 'Inter'], pattern: 'rays', blocks: 'rotate', hidden: ['stats'], order: ['highlights'] },
  carpenter: { h: 28, s: 0.6, accentShift: 30, fonts: ['Work Sans', 'Inter'], pattern: 'grid', blocks: 'keep', hidden: [] },
  painter: { h: 340, s: 0.7, accentShift: 40, fonts: ['Poppins', 'Work Sans'], pattern: 'blobs', blocks: 'reverse', hidden: ['stats'] },
  'ac-appliance-repair': { h: 190, s: 0.75, accentShift: 30, fonts: ['Manrope', 'Inter'], pattern: 'rings', blocks: 'rotate', hidden: [], order: ['highlights'] },
  'pest-control': { h: 128, s: 0.6, accentShift: 25, fonts: MB, pattern: 'dots', blocks: 'keep', hidden: ['stats'] },
  'home-cleaning': { h: 172, s: 0.65, accentShift: 35, fonts: ['Nunito', 'Work Sans'], pattern: 'dots', blocks: 'reverse', hidden: [] },
  locksmith: { h: 232, s: 0.7, accentShift: 30, fonts: ['Montserrat', 'Inter'], pattern: 'chevrons', blocks: 'keep', hidden: ['stats'], order: ['highlights'] },
  'packers-movers': { h: 18, s: 0.8, accentShift: 28, fonts: ['Poppins', 'Inter'], pattern: 'diagonal', blocks: 'rotate', hidden: [] },
  'mason-contractor': { h: 34, s: 0.55, accentShift: 20, fonts: ['Work Sans', 'Work Sans'], pattern: 'grid', blocks: 'reverse', hidden: ['stats'] },
  'cctv-security-installer': { h: 214, s: 0.75, accentShift: 32, fonts: ['Manrope', 'Manrope'], pattern: 'rings', blocks: 'keep', hidden: [] },
  'auto-mechanic': { h: 6, s: 0.75, accentShift: 24, fonts: ['Montserrat', 'Work Sans'], pattern: 'chevrons', blocks: 'rotate', hidden: ['stats'] },
  'car-wash-detailing': { h: 196, s: 0.85, accentShift: 36, fonts: ['Poppins', 'Manrope'], pattern: 'waves', blocks: 'reverse', hidden: [], order: ['highlights'] },
};

export default presetsFrom(TABLE, FAQS, buildPreset);
