import type { TFunction } from 'i18next';
import { Product } from '../types';

/**
 * Category names live in the database in English. Known slugs get a translated
 * label from the locale files (`categories.<slug>`); anything an admin adds
 * later falls back to its stored name, so a new category never shows a raw key.
 */
export const categoryLabel = (category: { slug: string; name: string }, t: TFunction): string =>
  t(`categories.${category.slug}`, { defaultValue: category.name });

/** One price string for cards and the product page, in the visitor's language. */
export const priceLabel = (product: Product, t: TFunction): string => {
  const currency = product.currency || 'RWF';
  if (product.pricePerMeter != null) {
    return t('products.price_per_meter', {
      defaultValue: '{{price}} / m',
      price: `${product.pricePerMeter.toLocaleString()} ${currency}`,
    });
  }
  const unit = product.salePrice ?? product.price;
  if (unit != null) return `${unit.toLocaleString()} ${currency}`;
  if (product.priceRange) return product.priceRange;
  return t('products.price_on_request', { defaultValue: 'Price on request' });
};
