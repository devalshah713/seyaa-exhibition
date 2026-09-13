// Single place to configure the exhibition sales portal.
//
// There is deliberately NO login on this portal: a salesperson opens the URL
// and searches straight away. Everything that varies per exhibition lives here.

export const PORTAL = {
  title: "Seyaa Stock Price Sheet",
  subtitle: "Exhibition sales portal",

  /**
   * Optional one-click coupon shown on every result card. Set to `null` to hide
   * the coupon button entirely and show the plain price only.
   */
  coupon: null as { code: string; percent: number } | null,

  /**
   * Lets a salesperson subtract a negotiated rupee amount from the total.
   * Set to false to hide the input.
   */
  showSpecialDiscount: true,

  /**
   * Flipped to false once a real price sheet has been imported with
   * `npm run import-sheet <file.xlsx>`. While true the portal shows a banner
   * warning that the numbers on screen are placeholders.
   */
  usingSampleData: true,
} as const;

/** Apply the configured coupon percentage to a gross INR amount. */
export function applyCoupon(amount: number | undefined): number | undefined {
  if (amount === undefined || Number.isNaN(amount) || !PORTAL.coupon) return amount;
  const factor = 1 - PORTAL.coupon.percent / 100;
  return Math.round(amount * factor * 100) / 100;
}

/** Subtract a fixed rupee discount from an amount. */
export function applySpecialDiscount(
  amount: number | undefined,
  discountAmt: number,
): number | undefined {
  if (amount === undefined || Number.isNaN(amount) || discountAmt <= 0) return amount;
  return Math.round((amount - discountAmt) * 100) / 100;
}
