export type Product = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  // Widened from the original literal union to plain `string`: real vendor products
  // (Website Manager -> My Products) carry a free-text category the vendor typed, not
  // one of the 6 curated demo buckets. Existing consumers only ever compare/display
  // this as a string, so nothing else needs to change.
  category: string;
  price: number;
  originalPrice?: number;
  image: string;
  gallery: string[];
  colors: { name: string; hex: string }[];
  sizes: string[];
  rating: number;
  reviews: number;
  description: string;
  features: string[];
  isNew?: boolean;
  isBestSeller?: boolean;
  stock: number;
};

export const categories = [
  { slug: 'sneakers', name: 'Sneakers', icon: 'Footprints' },
  { slug: 'running', name: 'Running', icon: 'Zap' },
  { slug: 'formal', name: 'Formal', icon: 'Briefcase' },
  { slug: 'sandals', name: 'Sandals', icon: 'Sun' },
  { slug: 'women', name: "Women's", icon: 'Sparkles' },
  { slug: 'apparel', name: 'Apparel', icon: 'Shirt' },
] as const;

export const products: Product[] = [
  {
    id: '1',
    slug: 'aero-flight-sneakers',
    name: 'Aero Flight Sneakers',
    brand: 'Step N Rock',
    category: 'sneakers',
    price: 89.99,
    originalPrice: 129.99,
    image: 'https://images.pexels.com/photos/1461048/pexels-photo-1461048.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    gallery: [
      'https://images.pexels.com/photos/1461048/pexels-photo-1461048.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      'https://images.pexels.com/photos/1464625/pexels-photo-1464625.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      'https://images.pexels.com/photos/27204251/pexels-photo-27204251.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    ],
    colors: [
      { name: 'White', hex: '#f5f5f5' },
      { name: 'Black', hex: '#1a1a1a' },
      { name: 'Blue', hex: '#2563eb' },
    ],
    sizes: ['6', '7', '8', '9', '10', '11', '12'],
    rating: 4.8,
    reviews: 342,
    description: 'The Aero Flight Sneakers combine breathable mesh uppers with responsive cushioning for all-day comfort. Perfect for street style and light workouts.',
    features: ['Breathable mesh upper', 'Responsive foam midsole', 'Rubber outsole for grip', 'Lightweight 240g per shoe'],
    isBestSeller: true,
    stock: 24,
  },
  {
    id: '2',
    slug: 'velocity-pro-running',
    name: 'Velocity Pro Running',
    brand: 'Step N Rock',
    category: 'running',
    price: 119.99,
    originalPrice: 149.99,
    image: 'https://images.pexels.com/photos/22745630/pexels-photo-22745630.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    gallery: [
      'https://images.pexels.com/photos/22745630/pexels-photo-22745630.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      'https://images.pexels.com/photos/25492111/pexels-photo-25492111.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      'https://images.pexels.com/photos/29520198/pexels-photo-29520198.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    ],
    colors: [
      { name: 'Black/White', hex: '#1a1a1a' },
      { name: 'Red', hex: '#dc2626' },
    ],
    sizes: ['6', '7', '8', '9', '10', '11', '12', '13'],
    rating: 4.9,
    reviews: 218,
    description: 'Engineered for speed. The Velocity Pro features a carbon-fiber plate and ultralight foam for explosive energy return on every stride.',
    features: ['Carbon-fiber propulsion plate', 'Ultralight PEBA foam', 'Race-ready fit', 'Breath knit upper'],
    isNew: true,
    stock: 15,
  },
  {
    id: '3',
    slug: 'oxford-classic-leather',
    name: 'Oxford Classic Leather',
    brand: 'Step N Rock',
    category: 'formal',
    price: 159.99,
    image: 'https://images.pexels.com/photos/31844638/pexels-photo-31844638.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    gallery: [
      'https://images.pexels.com/photos/31844638/pexels-photo-31844638.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      'https://images.pexels.com/photos/31844640/pexels-photo-31844640.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      'https://images.pexels.com/photos/31785887/pexels-photo-31785887.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    ],
    colors: [
      { name: 'Black', hex: '#1a1a1a' },
      { name: 'Brown', hex: '#78350f' },
    ],
    sizes: ['7', '8', '9', '10', '11', '12'],
    rating: 4.7,
    reviews: 156,
    description: 'Timeless Oxford silhouette handcrafted from full-grain leather. Goodyear welted construction for durability and resoleability.',
    features: ['Full-grain leather upper', 'Goodyear welt construction', 'Leather lining & insole', 'Durable rubber sole'],
    isBestSeller: true,
    stock: 18,
  },
  {
    id: '4',
    slug: 'summer-breeze-sandals',
    name: 'Summer Breeze Sandals',
    brand: 'Step N Rock',
    category: 'sandals',
    price: 49.99,
    originalPrice: 69.99,
    image: 'https://images.pexels.com/photos/26954373/pexels-photo-26954373.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    gallery: [
      'https://images.pexels.com/photos/26954373/pexels-photo-26954373.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      'https://images.pexels.com/photos/26954372/pexels-photo-26954372.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      'https://images.pexels.com/photos/26954368/pexels-photo-26954368.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    ],
    colors: [
      { name: 'Yellow', hex: '#facc15' },
      { name: 'Pink', hex: '#f9a8d4' },
      { name: 'Blue', hex: '#60a5fa' },
    ],
    sizes: ['5', '6', '7', '8', '9', '10', '11'],
    rating: 4.5,
    reviews: 89,
    description: 'Lightweight and breezy, these sandals are your perfect summer companion. Contoured footbed for all-day comfort.',
    features: ['Contoured EVA footbed', 'Quick-dry straps', 'Non-slip outsole', 'Vegan materials'],
    isNew: true,
    stock: 32,
  },
  {
    id: '5',
    slug: 'urban-pulse-hoodie',
    name: 'Urban Pulse Hoodie',
    brand: 'Step N Rock',
    category: 'apparel',
    price: 64.99,
    originalPrice: 84.99,
    image: 'https://images.pexels.com/photos/10284607/pexels-photo-10284607.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    gallery: [
      'https://images.pexels.com/photos/10284607/pexels-photo-10284607.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      'https://images.pexels.com/photos/15564085/pexels-photo-15564085.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      'https://images.pexels.com/photos/19461584/pexels-photo-19461584.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    ],
    colors: [
      { name: 'White', hex: '#f5f5f5' },
      { name: 'Black', hex: '#1a1a1a' },
      { name: 'Blue', hex: '#2563eb' },
    ],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    rating: 4.6,
    reviews: 127,
    description: 'Premium fleece-lined hoodie with a modern streetwear fit. Built for comfort and style on every occasion.',
    features: ['350gsm fleece cotton', 'Kangaroo pocket', 'Adjustable drawstring hood', 'Ribbed cuffs & hem'],
    stock: 40,
  },
  {
    id: '6',
    slug: 'scarlet-high-top-sneakers',
    name: 'Scarlet High-Top Sneakers',
    brand: 'Step N Rock',
    category: 'sneakers',
    price: 99.99,
    image: 'https://images.pexels.com/photos/26852497/pexels-photo-26852497.png?auto=compress&cs=tinysrgb&h=650&w=940',
    gallery: [
      'https://images.pexels.com/photos/26852497/pexels-photo-26852497.png?auto=compress&cs=tinysrgb&h=650&w=940',
      'https://images.pexels.com/photos/19845610/pexels-photo-19845610.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      'https://images.pexels.com/photos/27113455/pexels-photo-27113455.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    ],
    colors: [
      { name: 'Red', hex: '#dc2626' },
      { name: 'Black', hex: '#1a1a1a' },
    ],
    sizes: ['6', '7', '8', '9', '10', '11', '12'],
    rating: 4.7,
    reviews: 203,
    description: 'Bold high-top sneakers with premium canvas upper and vulcanized rubber sole. A streetwear icon.',
    features: ['Premium canvas upper', 'Vulcanized rubber sole', 'Padded ankle collar', 'Cushioned insole'],
    isBestSeller: true,
    stock: 21,
  },
  {
    id: '7',
    slug: 'cloud-walker-running',
    name: 'Cloud Walker Running',
    brand: 'Step N Rock',
    category: 'running',
    price: 79.99,
    originalPrice: 99.99,
    image: 'https://images.pexels.com/photos/11292946/pexels-photo-11292946.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    gallery: [
      'https://images.pexels.com/photos/11292946/pexels-photo-11292946.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      'https://images.pexels.com/photos/1464625/pexels-photo-1464625.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      'https://images.pexels.com/photos/356175/pexels-photo-356175.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    ],
    colors: [
      { name: 'White/Blue', hex: '#60a5fa' },
      { name: 'Black', hex: '#1a1a1a' },
    ],
    sizes: ['6', '7', '8', '9', '10', '11', '12', '13'],
    rating: 4.6,
    reviews: 175,
    description: 'Daily trainer with plush cushioning and durable outsole. Perfect for easy miles and everyday wear.',
    features: ['Plush EVA midsole', 'Durable carbon rubber outsole', 'Engineered mesh upper', 'Reflective details'],
    stock: 28,
  },
  {
    id: '8',
    slug: 'brook-tan-leather',
    name: 'Brook Tan Leather',
    brand: 'Step N Rock',
    category: 'formal',
    price: 139.99,
    originalPrice: 179.99,
    image: 'https://images.pexels.com/photos/32644170/pexels-photo-32644170.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    gallery: [
      'https://images.pexels.com/photos/32644170/pexels-photo-32644170.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      'https://images.pexels.com/photos/32644171/pexels-photo-32644171.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      'https://images.pexels.com/photos/31844639/pexels-photo-31844639.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    ],
    colors: [
      { name: 'Tan', hex: '#d4a574' },
      { name: 'Dark Brown', hex: '#78350f' },
    ],
    sizes: ['7', '8', '9', '10', '11', '12'],
    rating: 4.8,
    reviews: 94,
    description: 'Sophisticated tan leather shoes with a modern silhouette. Versatile enough for office to evening.',
    features: ['Genuine leather upper', 'Cushioned footbed', 'Flexible construction', 'Classic blucher style'],
    stock: 12,
  },
  {
    id: '9',
    slug: 'rose-petal-heels',
    name: 'Rose Petal Heels',
    brand: 'Step N Rock',
    category: 'women',
    price: 89.99,
    image: 'https://images.pexels.com/photos/27063075/pexels-photo-27063075.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    gallery: [
      'https://images.pexels.com/photos/27063075/pexels-photo-27063075.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      'https://images.pexels.com/photos/27174554/pexels-photo-27174554.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      'https://images.pexels.com/photos/26925260/pexels-photo-26925260.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    ],
    colors: [
      { name: 'Nude', hex: '#f0d9c0' },
      { name: 'Black', hex: '#1a1a1a' },
      { name: 'Red', hex: '#dc2626' },
    ],
    sizes: ['5', '6', '7', '8', '9', '10'],
    rating: 4.7,
    reviews: 112,
    description: 'Elegant block-heel sandals with premium leather upper. Designed for comfort without compromising style.',
    features: ['Premium leather upper', 'Comfort block heel', 'Adjustable ankle strap', 'Cushioned footbed'],
    isNew: true,
    stock: 19,
  },
  {
    id: '10',
    slug: 'coastal-flip-flops',
    name: 'Coastal Flip Flops',
    brand: 'Step N Rock',
    category: 'sandals',
    price: 24.99,
    originalPrice: 34.99,
    image: 'https://images.pexels.com/photos/28607587/pexels-photo-28607587.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    gallery: [
      'https://images.pexels.com/photos/28607587/pexels-photo-28607587.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      'https://images.pexels.com/photos/27127392/pexels-photo-27127392.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      'https://images.pexels.com/photos/2098848/pexels-photo-2098848.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    ],
    colors: [
      { name: 'Pink', hex: '#f9a8d4' },
      { name: 'Yellow', hex: '#facc15' },
    ],
    sizes: ['5', '6', '7', '8', '9', '10', '11', '12'],
    rating: 4.3,
    reviews: 67,
    description: 'Classic flip flops with soft footbed and durable outsole. Your go-to for beach days and casual outings.',
    features: ['Soft EVA footbed', 'Durable rubber outsole', 'Quick-dry straps', 'Lightweight design'],
    stock: 50,
  },
  {
    id: '11',
    slug: 'graphite-runner-sneakers',
    name: 'Graphite Runner Sneakers',
    brand: 'Step N Rock',
    category: 'sneakers',
    price: 109.99,
    originalPrice: 139.99,
    image: 'https://images.pexels.com/photos/19869760/pexels-photo-19869760.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    gallery: [
      'https://images.pexels.com/photos/19869760/pexels-photo-19869760.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      'https://images.pexels.com/photos/19869759/pexels-photo-19869759.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      'https://images.pexels.com/photos/27008322/pexels-photo-27008322.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    ],
    colors: [
      { name: 'Blue', hex: '#2563eb' },
      { name: 'Gray', hex: '#6b7280' },
    ],
    sizes: ['6', '7', '8', '9', '10', '11', '12'],
    rating: 4.8,
    reviews: 289,
    description: 'Sleek lifestyle sneakers with a modern aesthetic. Premium materials and superior comfort for everyday wear.',
    features: ['Premium suede & mesh upper', 'OrthoLite insole', 'EVA midsole', 'Grippy rubber outsole'],
    isBestSeller: true,
    stock: 16,
  },
  {
    id: '12',
    slug: 'noir-block-heel-sandals',
    name: 'Noir Block Heel Sandals',
    brand: 'Step N Rock',
    category: 'women',
    price: 74.99,
    originalPrice: 94.99,
    image: 'https://images.pexels.com/photos/27046154/pexels-photo-27046154.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    gallery: [
      'https://images.pexels.com/photos/27046154/pexels-photo-27046154.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      'https://images.pexels.com/photos/27046150/pexels-photo-27046150.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      'https://images.pexels.com/photos/27204291/pexels-photo-27204291.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    ],
    colors: [
      { name: 'Black', hex: '#1a1a1a' },
      { name: 'White', hex: '#f5f5f5' },
    ],
    sizes: ['5', '6', '7', '8', '9', '10'],
    rating: 4.6,
    reviews: 78,
    description: 'Chic block heel sandals with timeless appeal. The versatile design transitions seamlessly from day to night.',
    features: ['Leather upper', '3cm block heel', 'Open-toe design', 'Buckle ankle strap'],
    stock: 23,
  },
];

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getProductsByCategory(category: string): Product[] {
  return products.filter((p) => p.category === category);
}

export function getFeaturedProducts(): Product[] {
  return products.filter((p) => p.isBestSeller || p.isNew);
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price);
}
