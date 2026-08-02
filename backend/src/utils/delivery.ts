export const DELIVERY_FEES: Record<string, number> = {
  'Kigali City': 2000,
  'Northern Province': 5000,
  'Southern Province': 5000,
  'Eastern Province': 5000,
  'Western Province': 5000,
};

export function getDeliveryFee(province: string): number {
  return DELIVERY_FEES[province] ?? 5000;
}
