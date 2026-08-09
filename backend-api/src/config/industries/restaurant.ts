import { IndustryConfig } from './types';

export const restaurantConfig: IndustryConfig = {
  key: 'restaurant',
  label: 'Restaurant',
  icon: 'UtensilsCrossed',
  entities: {
    contact: { label: 'Customer', labelPlural: 'Customers' },
    catalogItem: { label: 'Menu Item', labelPlural: 'Menu' },
    record: { label: 'Order', labelPlural: 'Orders' },
  },
  recordStatuses: [
    { key: 'new', label: 'New', color: '#64748b' },
    { key: 'preparing', label: 'Preparing', color: '#f59e0b' },
    { key: 'ready', label: 'Ready', color: '#2563eb' },
    { key: 'served', label: 'Served', color: '#16a34a' },
    { key: 'cancelled', label: 'Cancelled', color: '#dc2626' },
  ],
  recordCustomFields: [
    { key: 'tableNumber', label: 'Table Number', type: 'text' },
    {
      key: 'orderType',
      label: 'Order Type',
      type: 'select',
      options: ['Dine-in', 'Takeaway', 'Delivery'],
      required: true,
    },
  ],
  catalogCustomFields: [
    { key: 'category', label: 'Category', type: 'select', options: ['Starter', 'Main Course', 'Dessert', 'Beverage'] },
    { key: 'foodType', label: 'Food Type', type: 'select', options: ['Veg', 'Non-Veg', 'Egg'] },
  ],
  defaultAddons: ['table_management'],
  availableAddons: ['table_management', 'inventory_management'],
  websiteTemplate: 'restaurant',
  dashboardTabs: [
    { key: 'orders', label: 'Orders', icon: 'ClipboardList' },
    { key: 'tables', label: 'Tables', icon: 'Grid3x3' },
    { key: 'menu', label: 'Menu', icon: 'BookOpen' },
    { key: 'kitchen', label: 'Kitchen Display', icon: 'ChefHat' },
    { key: 'billing', label: 'Billing', icon: 'Receipt' },
  ],
};
