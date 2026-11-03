import { makePalette } from '../../lib/preset-build.mjs';
import presets from './presets.mjs';

// Shop Lite: the 8 Ecommerce categories. Bright and product-first. With the cart entitlement off every product has an enquiry link; with it on, add to cart.
export default {
  id: 'free-shop-lite',
  name: 'Shop Lite',
  description: 'For small shops (fashion, jewellery, grocery, bakery, electronics, furniture, gifts, books): a small catalogue of up to 12 products, category chips, an offers strip, the delivery PIN check note where the category has it, an order-on-WhatsApp button and a short delivery and returns note. Product enquiry links, or add to cart when the shop has the cart. Bright and product-first.',
  tier: 'Standard',
  tracks: ['ecommerce'],
  families: ['fashion-lifestyle', 'food-grocery', 'electronics-home', 'gifts-books'],
  palette: makePalette({ h: 350, s: 0.8, accentShift: 40 }),
  fonts: { heading: 'Poppins', body: 'DM Sans' },
  radius: '16px',
  presets,
};
