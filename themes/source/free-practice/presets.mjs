// Category presets for Practice (healthcare, legal and finance, creative and consulting: 11 categories).
import { buildPreset } from '../../lib/preset-build.mjs';
import { presetsFrom } from '../shared/preset-content.mjs';

const FAQS = {
  en: [
    { q: 'How do I book an appointment?', a: 'Use the button above, call us, or message us on WhatsApp. We will confirm a time with you.' },
    { q: 'Can I consult you online?', a: 'Many consultations can be done by phone or video. Ask us which {label} services are available online.' },
    { q: 'What should I bring with me?', a: 'Bring any earlier reports, papers or notes that relate to your visit.' },
    { q: 'What are your timings?', a: 'See the opening hours on this page. Appointments are preferred so that we can give you enough time.' },
    { q: 'Is the information on this website advice?', a: 'The information here is general. Please speak to us about your own situation before you decide anything.' },
  ],
  ta: [
    { q: 'நேரத்தை எப்படி முன்பதிவு செய்வது?', a: 'மேலே உள்ள பொத்தானை அழுத்துங்கள், அழையுங்கள் அல்லது வாட்ஸ்அப்பில் செய்தி அனுப்புங்கள். நேரத்தை உறுதிப்படுத்துவோம்.' },
    { q: 'ஆன்லைனில் ஆலோசனை பெற முடியுமா?', a: 'பல ஆலோசனைகளை தொலைபேசி அல்லது வீடியோ மூலம் செய்யலாம். எந்த {label} சேவைகள் ஆன்லைனில் கிடைக்கும் என்று கேளுங்கள்.' },
    { q: 'என்னென்ன கொண்டு வர வேண்டும்?', a: 'உங்கள் வருகை தொடர்பான முந்தைய அறிக்கைகள், ஆவணங்கள் அல்லது குறிப்புகளைக் கொண்டு வாருங்கள்.' },
    { q: 'உங்கள் நேரங்கள் என்ன?', a: 'இந்தப் பக்கத்தில் உள்ள திறந்திருக்கும் நேரங்களைப் பாருங்கள். போதிய நேரம் தர முன்பதிவு விரும்பப்படுகிறது.' },
    { q: 'இந்த இணையதளத்தில் உள்ள தகவல் ஆலோசனையா?', a: 'இங்குள்ள தகவல் பொதுவானது. எதையும் முடிவு செய்யும் முன் உங்கள் சொந்த நிலை பற்றி எங்களிடம் பேசுங்கள்.' },
  ],
};

const TABLE = {
  'doctor-clinic': { h: 178, s: 0.55, accentShift: 25, fonts: ['Lora', 'Inter'], pattern: 'dots', blocks: 'keep', hidden: ['stats'] },
  dentist: { h: 196, s: 0.6, accentShift: 30, fonts: ['Manrope', 'Inter'], pattern: 'rings', blocks: 'rotate', hidden: ['stats'] },
  physiotherapy: { h: 152, s: 0.5, accentShift: 28, fonts: ['Lora', 'Work Sans'], pattern: 'waves', blocks: 'keep', hidden: [] },
  'diagnostics-lab': { h: 236, s: 0.5, accentShift: 30, fonts: ['Merriweather', 'Inter'], pattern: 'grid', blocks: 'reverse', hidden: ['stats'] },
  lawyer: { h: 224, s: 0.55, accentShift: 22, fonts: ['Playfair Display', 'Inter'], pattern: 'diagonal', blocks: 'keep', hidden: ['stats'], order: ['highlights'] },
  'ca-tax-consultant': { h: 98, s: 0.4, accentShift: 30, fonts: ['Merriweather', 'Work Sans'], pattern: 'grid', blocks: 'rotate', hidden: [] },
  'insurance-advisor': { h: 208, s: 0.6, accentShift: 28, fonts: ['Lora', 'Inter'], pattern: 'chevrons', blocks: 'keep', hidden: ['stats'] },
  photographer: { h: 302, s: 0.45, accentShift: 40, fonts: ['Playfair Display', 'Work Sans'], pattern: 'blobs', blocks: 'rotate', hidden: ['stats'] },
  'interior-designer-architect': { h: 16, s: 0.5, accentShift: 28, fonts: ['Lora', 'Work Sans'], pattern: 'diagonal', blocks: 'reverse', hidden: [] },
  'event-planner': { h: 336, s: 0.55, accentShift: 36, fonts: ['Playfair Display', 'Inter'], pattern: 'blobs', blocks: 'keep', hidden: ['stats'] },
  'it-consultant': { h: 256, s: 0.55, accentShift: 30, fonts: ['Manrope', 'Manrope'], pattern: 'rays', blocks: 'rotate', hidden: [], order: ['highlights'] },
};

export default presetsFrom(TABLE, FAQS, buildPreset);
