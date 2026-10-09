/** The chart of accounts every vendor gets on first use. Codes are fixed (reports depend on them); names may be shown as-is. */
export type AccountType = 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE' | 'EQUITY';

export const ACC = {
  CASH: '1000',
  BANK: '1010', // bank and UPI
  GATEWAY: '1020', // money held by the vendor's own payment gateway, not yet settled
  RECEIVABLES: '1100',
  STOCK: '1200',
  INPUT_CGST: '1300',
  INPUT_SGST: '1301',
  INPUT_IGST: '1302',
  SUPPLIER_ADVANCES: '1400',
  PAYABLES: '2000',
  OUTPUT_CGST: '2100',
  OUTPUT_SGST: '2101',
  OUTPUT_IGST: '2102',
  CUSTOMER_ADVANCES: '2200',
  CAPITAL: '3000',
  SALES: '4000',
  SALES_RETURNS: '4010',
  ROUND_OFF: '4900',
  PURCHASES: '5000',
  COGS: '5100',
  STOCK_LOSS: '5200',
  RENT: '5300',
  SALARIES: '5310',
  UTILITIES: '5320',
  TRANSPORT: '5330',
  MARKETING: '5340',
  OFFICE: '5350',
  REPAIRS: '5360',
  PROFESSIONAL: '5370',
  BANK_CHARGES: '5380',
  OTHER_EXPENSE: '5399',
} as const;

export interface AccountSeed { code: string; name: string; type: AccountType }

export const DEFAULT_ACCOUNTS: AccountSeed[] = [
  { code: ACC.CASH, name: 'Cash in hand', type: 'ASSET' },
  { code: ACC.BANK, name: 'Bank and UPI', type: 'ASSET' },
  { code: ACC.GATEWAY, name: 'Payment gateway (not yet settled)', type: 'ASSET' },
  { code: ACC.RECEIVABLES, name: 'Customers owe you', type: 'ASSET' },
  { code: ACC.STOCK, name: 'Stock', type: 'ASSET' },
  { code: ACC.INPUT_CGST, name: 'GST you can claim: CGST', type: 'ASSET' },
  { code: ACC.INPUT_SGST, name: 'GST you can claim: SGST', type: 'ASSET' },
  { code: ACC.INPUT_IGST, name: 'GST you can claim: IGST', type: 'ASSET' },
  { code: ACC.SUPPLIER_ADVANCES, name: 'Advances paid to suppliers', type: 'ASSET' },
  { code: ACC.PAYABLES, name: 'You owe suppliers', type: 'LIABILITY' },
  { code: ACC.OUTPUT_CGST, name: 'GST you collected: CGST', type: 'LIABILITY' },
  { code: ACC.OUTPUT_SGST, name: 'GST you collected: SGST', type: 'LIABILITY' },
  { code: ACC.OUTPUT_IGST, name: 'GST you collected: IGST', type: 'LIABILITY' },
  { code: ACC.CUSTOMER_ADVANCES, name: 'Advances received from customers', type: 'LIABILITY' },
  { code: ACC.CAPITAL, name: 'Owner capital', type: 'EQUITY' },
  { code: ACC.SALES, name: 'Sales', type: 'INCOME' },
  { code: ACC.SALES_RETURNS, name: 'Sales returns', type: 'INCOME' },
  { code: ACC.ROUND_OFF, name: 'Round off', type: 'INCOME' },
  { code: ACC.PURCHASES, name: 'Purchases (items not kept in stock)', type: 'EXPENSE' },
  { code: ACC.COGS, name: 'Cost of goods sold', type: 'EXPENSE' },
  { code: ACC.STOCK_LOSS, name: 'Stock loss and write-offs', type: 'EXPENSE' },
  { code: ACC.RENT, name: 'Rent', type: 'EXPENSE' },
  { code: ACC.SALARIES, name: 'Salaries and wages', type: 'EXPENSE' },
  { code: ACC.UTILITIES, name: 'Electricity, water and internet', type: 'EXPENSE' },
  { code: ACC.TRANSPORT, name: 'Transport and delivery', type: 'EXPENSE' },
  { code: ACC.MARKETING, name: 'Marketing and advertising', type: 'EXPENSE' },
  { code: ACC.OFFICE, name: 'Office and stationery', type: 'EXPENSE' },
  { code: ACC.REPAIRS, name: 'Repairs and maintenance', type: 'EXPENSE' },
  { code: ACC.PROFESSIONAL, name: 'Professional fees', type: 'EXPENSE' },
  { code: ACC.BANK_CHARGES, name: 'Bank and gateway charges', type: 'EXPENSE' },
  { code: ACC.OTHER_EXPENSE, name: 'Other expenses', type: 'EXPENSE' },
];

/** Expense heads a vendor can pick for an expense (the EXPENSE accounts a person would choose by hand). */
export const EXPENSE_HEADS = DEFAULT_ACCOUNTS.filter((a) => a.type === 'EXPENSE' && ![ACC.PURCHASES, ACC.COGS, ACC.STOCK_LOSS].includes(a.code as never));

export const PAYMENT_MODES = ['CASH', 'UPI', 'BANK', 'CARD', 'CHEQUE', 'GATEWAY'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

/** Which asset account money lands in (or leaves from) for a payment mode. */
export function accountForMode(mode: string): string {
  if (mode === 'CASH') return ACC.CASH;
  if (mode === 'GATEWAY') return ACC.GATEWAY;
  return ACC.BANK; // UPI, BANK, CARD, CHEQUE
}
