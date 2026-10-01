export interface PortfolioPhoto {
  src: string;
  category: string;
  title: string;
  span: string;
}

// The original uploaded design's showcase gallery - kept as the graceful
// fallback (same pattern as lib/services.ts's `services`) until the vendor
// uploads real portfolio photos via the dashboard.
export const fallbackPhotos: PortfolioPhoto[] = [
  { src: 'https://images.pexels.com/photos/17657612/pexels-photo-17657612.jpeg?auto=compress&cs=tinysrgb&w=900', category: 'Ceremony', title: 'The Sacred Vows', span: 'lg:col-span-2 lg:row-span-2' },
  { src: 'https://images.pexels.com/photos/19027172/pexels-photo-19027172.jpeg?auto=compress&cs=tinysrgb&w=600', category: 'Portraits', title: 'First Embrace', span: '' },
  { src: 'https://images.pexels.com/photos/37951751/pexels-photo-37951751.jpeg?auto=compress&cs=tinysrgb&w=600', category: 'Details', title: 'Henna & Gold', span: '' },
  { src: 'https://images.pexels.com/photos/30184675/pexels-photo-30184675.jpeg?auto=compress&cs=tinysrgb&w=900', category: 'Ceremony', title: 'Red & Reverence', span: 'lg:col-span-2' },
  { src: 'https://images.pexels.com/photos/31275058/pexels-photo-31275058.jpeg?auto=compress&cs=tinysrgb&w=600', category: 'Details', title: 'Bangles & Tradition', span: '' },
  { src: 'https://images.pexels.com/photos/18361996/pexels-photo-18361996.jpeg?auto=compress&cs=tinysrgb&w=600', category: 'Celebration', title: 'Under the Lights', span: '' },
  { src: 'https://images.pexels.com/photos/35457631/pexels-photo-35457631.jpeg?auto=compress&cs=tinysrgb&w=600', category: 'Celebration', title: 'Petals & Joy', span: '' },
  { src: 'https://images.pexels.com/photos/11965606/pexels-photo-11965606.jpeg?auto=compress&cs=tinysrgb&w=600', category: 'Portraits', title: 'Quiet Moment', span: 'lg:row-span-2' },
  { src: 'https://images.pexels.com/photos/31002342/pexels-photo-31002342.jpeg?auto=compress&cs=tinysrgb&w=900', category: 'Ceremony', title: 'Garland of Love', span: 'lg:col-span-2' },
  { src: 'https://images.pexels.com/photos/34479857/pexels-photo-34479857.jpeg?auto=compress&cs=tinysrgb&w=600', category: 'Details', title: 'Sacred Ritual', span: '' },
  { src: 'https://images.pexels.com/photos/32212565/pexels-photo-32212565.jpeg?auto=compress&cs=tinysrgb&w=600', category: 'Portraits', title: 'Night Embrace', span: '' },
  { src: 'https://images.pexels.com/photos/20708572/pexels-photo-20708572.jpeg?auto=compress&cs=tinysrgb&w=600', category: 'Details', title: 'Hands Together', span: '' },
];

export const portfolioCategories = ['All', 'Ceremony', 'Portraits', 'Details', 'Celebration'];
