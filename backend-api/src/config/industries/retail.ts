import { IndustryConfig } from './types';

export const retailConfig: IndustryConfig = {
  key: 'retail',
  label: 'Retail & Store',
  icon: 'ShoppingBag',
  entities: {
    contact: { label: 'Customer', labelPlural: 'Customers' },
    catalogItem: { label: 'Product', labelPlural: 'Products' },
    record: { label: 'Order', labelPlural: 'Orders' },
  },
  recordStatuses: [
    { key: 'pending', label: 'Pending', color: '#64748b' },
    { key: 'confirmed', label: 'Confirmed', color: '#2563eb' },
    { key: 'shipped', label: 'Shipped', color: '#f59e0b' },
    { key: 'delivered', label: 'Delivered', color: '#16a34a' },
    { key: 'returned', label: 'Returned', color: '#dc2626' },
  ],
  recordCustomFields: [
    { key: 'orderType', label: 'Order Type', type: 'select', options: ['In-store', 'Online', 'Phone'] },
    { key: 'deliveryAddress', label: 'Delivery Address', type: 'textarea' },
  ],
  catalogCustomFields: [
    { key: 'sku', label: 'SKU', type: 'text' },
    { key: 'stock', label: 'Stock', type: 'number' },
  ],
  defaultAddons: ['inventory_management'],
  availableAddons: ['inventory_management'],
  websiteTemplate: 'retail',
  dashboardTabs: [
    { key: 'orders', label: 'Orders', icon: 'ClipboardList' },
    // Was "Products" — renamed so it's not confused with the website-facing "My
    // Products" (VendorProduct/CmsService) sidebar item. This tab is the RetailProduct
    // CRUD screen (SKU, stock qty, reorder level) that feeds both the "Inventory" tab's
    // stock-monitoring view and POS sales — an in-store stock/SKU concern, not website
    // content. "Inventory & POS" was the first choice but collides with the existing
    // "Inventory" and "Orders" (POS) tabs right next to it, so this uses "Stock & SKU"
    // instead — same intent (disambiguate from website content), no name collision.
    { key: 'products', label: 'Stock & SKU', icon: 'Package' },
    { key: 'customers', label: 'Customers', icon: 'Users' },
    { key: 'inventory', label: 'Inventory', icon: 'Boxes' },
  ],
};
