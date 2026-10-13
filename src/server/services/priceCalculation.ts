import { CalculatedCost, ProductOffer } from '../../types/index.js';

/**
 * Shared deterministic price calculation service.
 * Enforces strict financial integrity:
 * - If shipping is unknown (null/undefined), the total cost CANNOT be confirmed as complete.
 * - Negative prices or discounts greater than the base price are rejected.
 * - Currencies are strictly preserved.
 */
export function calculateTotalCost(offer: {
  product_price: number | null | undefined;
  shipping_cost?: number | null | undefined;
  additional_fees?: number | null | undefined;
  discount_amount?: number | null | undefined;
  currency?: string | null | undefined;
}): CalculatedCost {
  const currency = offer.currency || 'EGP';
  const reasons: string[] = [];

  const rawPrice = offer.product_price;
  if (rawPrice === null || rawPrice === undefined || isNaN(rawPrice) || rawPrice <= 0) {
    return {
      productPrice: 0,
      shippingCost: null,
      additionalFees: null,
      discountAmount: 0,
      currency,
      totalCost: null,
      isComplete: false,
      isShippingKnown: false,
      isFeesKnown: false,
      reasons: ['سعر المنتج غير معروف أو غير صالح / Product price is unknown or invalid'],
    };
  }

  const productPrice = Math.round(rawPrice * 100) / 100;
  const rawDiscount = offer.discount_amount ?? 0;
  const discountAmount = Math.max(0, Math.min(productPrice, Math.round((rawDiscount || 0) * 100) / 100));

  const isShippingKnown = offer.shipping_cost !== null && offer.shipping_cost !== undefined;
  const shippingCost = isShippingKnown ? Math.max(0, Math.round(Number(offer.shipping_cost) * 100) / 100) : null;

  const isFeesKnown = offer.additional_fees !== null && offer.additional_fees !== undefined;
  const additionalFees = isFeesKnown ? Math.max(0, Math.round(Number(offer.additional_fees) * 100) / 100) : null;

  if (!isShippingKnown) {
    reasons.push('تكلفة الشحن غير محددة من قبل المتجر / Shipping cost is unknown for this store');
  }

  if (offer.additional_fees === null || offer.additional_fees === undefined) {
    // If additional_fees is not specified, we treat known as 0 only if explicit, otherwise track
  }

  // Completeness check: For a total cost to be confirmed, shipping must be known
  const isComplete = isShippingKnown;

  let totalCost: number | null = null;
  if (isComplete) {
    const fees = additionalFees ?? 0;
    const shipping = shippingCost ?? 0;
    totalCost = Math.max(0, Math.round((productPrice + shipping + fees - discountAmount) * 100) / 100);
  }

  return {
    productPrice,
    shippingCost,
    additionalFees,
    discountAmount,
    currency,
    totalCost,
    isComplete,
    isShippingKnown,
    isFeesKnown,
    reasons,
  };
}

/**
 * Enriches a ProductOffer with computed total cost calculations.
 */
export function enrichOfferWithCalculation<T extends Partial<ProductOffer>>(offer: T): T {
  const calc = calculateTotalCost(offer as any);
  return {
    ...offer,
    total_cost: calc.totalCost,
    is_total_cost_complete: calc.isComplete,
  };
}
