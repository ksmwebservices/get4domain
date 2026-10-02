/**
 * DomainCampaign management-fee model — V2 PRD §88 (all amounts in paise, GST-exclusive):
 *   monthly ad spend ≤ ₹20,000            → ₹2,000/month
 *   ₹20,001 – ₹1,00,000                   → ₹5,000/month
 *   above ₹1,00,000                       → ₹10,000/month
 *   Enterprise / multi-brand              → custom (admin-entered per record)
 * Ad spend itself is paid to the ad platforms, not to Get4Domain.
 */
export const DC_BRACKET_1_MAX_SPEND_PAISE = 2_000_000; // ₹20,000 (inclusive)
export const DC_BRACKET_2_MAX_SPEND_PAISE = 10_000_000; // ₹1,00,000 (inclusive)

export const DC_BRACKET_1_FEE_PAISE = 200_000; // ₹2,000
export const DC_BRACKET_2_FEE_PAISE = 500_000; // ₹5,000
export const DC_BRACKET_3_FEE_PAISE = 1_000_000; // ₹10,000

export type DcBracket = 1 | 2 | 3;

export function dcBracketFor(adSpendPaise: number): DcBracket {
  if (adSpendPaise <= DC_BRACKET_1_MAX_SPEND_PAISE) return 1;
  if (adSpendPaise <= DC_BRACKET_2_MAX_SPEND_PAISE) return 2;
  return 3;
}

export function dcBracketFee(adSpendPaise: number): number {
  const bracket = dcBracketFor(adSpendPaise);
  if (bracket === 1) return DC_BRACKET_1_FEE_PAISE;
  if (bracket === 2) return DC_BRACKET_2_FEE_PAISE;
  return DC_BRACKET_3_FEE_PAISE;
}

export const DC_BRACKET_LABEL: Record<DcBracket, string> = {
  1: 'up to ₹20,000 ad spend',
  2: '₹20,001–₹1,00,000 ad spend',
  3: 'above ₹1,00,000 ad spend',
};

/**
 * The fee for a month: the bracket fee, unless the client is Enterprise/custom,
 * in which case the admin-entered amount is used and the bracket is bypassed.
 */
export function dcResolveFee(adSpendPaise: number, isCustomFee: boolean, customFeePaise?: number): number {
  if (isCustomFee) {
    if (!Number.isInteger(customFeePaise) || (customFeePaise as number) <= 0) {
      throw new RangeError('A custom fee amount greater than zero is required for Enterprise/custom clients');
    }
    return customFeePaise as number;
  }
  return dcBracketFee(adSpendPaise);
}
