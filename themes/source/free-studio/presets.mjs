// Category presets for Studio (education and wellness-beauty: 5 categories).
import { buildPreset } from '../../lib/preset-build.mjs';
import { presetsFrom } from '../shared/preset-content.mjs';

const FAQS = {
  en: [
    { q: 'Can I try a class first?', a: 'Yes. Ask us for a trial or demo session before you decide.' },
    { q: 'What are the batch and class timings?', a: 'Timings are listed on this page. Call us if you need a different time.' },
    { q: 'How much are the fees?', a: 'Fees depend on the course or plan. Ask us for the full list and we will explain what is included.' },
    { q: 'Who will teach or train me?', a: 'You will meet your teacher or trainer during the trial.' },
    { q: 'How do I join?', a: 'Send an enquiry, call us or message us on WhatsApp and we will help you choose the right batch.' },
  ],
  ta: [
    { q: 'முதலில் ஒரு வகுப்பில் கலந்து பார்க்கலாமா?', a: 'ஆம். முடிவு செய்யும் முன் சோதனை அல்லது டெமோ வகுப்பைக் கேளுங்கள்.' },
    { q: 'பிரிவு மற்றும் வகுப்பு நேரங்கள் என்ன?', a: 'நேரங்கள் இந்தப் பக்கத்தில் உள்ளன. வேறு நேரம் வேண்டுமெனில் அழையுங்கள்.' },
    { q: 'கட்டணம் எவ்வளவு?', a: 'கட்டணம் படிப்பு அல்லது திட்டத்தைப் பொறுத்தது. முழுப் பட்டியலைக் கேளுங்கள், என்னென்ன அடங்கும் என்று விளக்குவோம்.' },
    { q: 'யார் கற்பிப்பார் அல்லது பயிற்சி அளிப்பார்?', a: 'சோதனை வகுப்பில் உங்கள் ஆசிரியர் அல்லது பயிற்சியாளரைச் சந்திப்பீர்கள்.' },
    { q: 'எப்படிச் சேருவது?', a: 'விசாரணை அனுப்புங்கள், அழையுங்கள் அல்லது வாட்ஸ்அப்பில் செய்தி அனுப்புங்கள்; சரியான பிரிவைத் தேர்ந்தெடுக்க உதவுவோம்.' },
  ],
};

const TABLE = {
  'coaching-centre': { h: 262, s: 0.7, accentShift: 55, fonts: ['Nunito', 'Poppins'], pattern: 'blobs', blocks: 'rotate', hidden: [] },
  tutor: { h: 28, s: 0.8, accentShift: 35, fonts: ['Poppins', 'Nunito'], pattern: 'dots', blocks: 'keep', hidden: ['stats'] },
  'music-dance-school': { h: 318, s: 0.65, accentShift: 40, fonts: ['Nunito', 'Nunito'], pattern: 'rings', blocks: 'reverse', hidden: ['stats'] },
  'salon-spa': { h: 346, s: 0.6, accentShift: 30, fonts: ['DM Sans', 'DM Sans'], pattern: 'waves', blocks: 'keep', hidden: [] },
  'gym-yoga': { h: 148, s: 0.7, accentShift: 40, fonts: ['Montserrat', 'Poppins'], pattern: 'rays', blocks: 'rotate', hidden: [], order: ['highlights'] },
};

export default presetsFrom(TABLE, FAQS, buildPreset);
