// Category presets for Hospitality and Property (restaurant and cafe, hotel and homestay, travel agency, real estate agent).
import { buildPreset } from '../../lib/preset-build.mjs';
import { presetsFrom } from '../shared/preset-content.mjs';

const FAQS = {
  en: [
    { q: 'Do I need to book in advance?', a: 'Booking is recommended, especially at weekends and in the holiday season. Use the button above or call us.' },
    { q: 'Can you handle special requests?', a: 'Tell us what you need when you book and we will do our best to arrange it.' },
    { q: 'Where are you and how do I get there?', a: 'Our address and a map are on this page. Tap Directions to open it on your phone.' },
    { q: 'What are your timings?', a: 'See the opening hours on this page. Call us if you are coming at an unusual time.' },
    { q: 'How do I pay?', a: 'We accept UPI, cash and bank transfer.' },
  ],
  ta: [
    { q: 'முன்கூட்டியே முன்பதிவு செய்ய வேண்டுமா?', a: 'குறிப்பாக வார இறுதி மற்றும் விடுமுறைக் காலத்தில் முன்பதிவு பரிந்துரைக்கப்படுகிறது. மேலே உள்ள பொத்தானை அழுத்துங்கள் அல்லது அழையுங்கள்.' },
    { q: 'சிறப்புக் கோரிக்கைகளைக் கையாள முடியுமா?', a: 'முன்பதிவு செய்யும்போது உங்கள் தேவையைச் சொல்லுங்கள், ஏற்பாடு செய்ய முயற்சிப்போம்.' },
    { q: 'நீங்கள் எங்கே இருக்கிறீர்கள், எப்படி வருவது?', a: 'எங்கள் முகவரியும் வரைபடமும் இந்தப் பக்கத்தில் உள்ளன. உங்கள் தொலைபேசியில் திறக்க வழி என்பதை அழுத்துங்கள்.' },
    { q: 'உங்கள் நேரங்கள் என்ன?', a: 'இந்தப் பக்கத்தில் உள்ள திறந்திருக்கும் நேரங்களைப் பாருங்கள். வழக்கத்துக்கு மாறான நேரத்தில் வந்தால் அழையுங்கள்.' },
    { q: 'எப்படிப் பணம் செலுத்துவது?', a: 'UPI, ரொக்கம் மற்றும் வங்கிப் பரிமாற்றம் ஏற்கப்படும்.' },
  ],
};

const TABLE = {
  'restaurant-cafe': { h: 14, s: 0.7, accentShift: 28, fonts: ['Playfair Display', 'Work Sans'], pattern: 'dots', blocks: 'keep', hidden: ['stats'] },
  'hotel-homestay': { h: 36, s: 0.6, accentShift: 22, fonts: ['Lora', 'Inter'], pattern: 'rings', blocks: 'rotate', hidden: [], order: ['highlights'] },
  'travel-agency': { h: 202, s: 0.75, accentShift: 30, fonts: ['Poppins', 'Work Sans'], pattern: 'waves', blocks: 'reverse', hidden: ['stats'] },
  'real-estate-agent': { h: 158, s: 0.55, accentShift: 32, fonts: ['Playfair Display', 'Inter'], pattern: 'chevrons', blocks: 'keep', hidden: [] },
};

export default presetsFrom(TABLE, FAQS, buildPreset);
