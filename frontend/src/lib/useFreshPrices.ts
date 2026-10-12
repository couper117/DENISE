import { useEffect, useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { productsApi } from './api';
import { CartItem, Product } from '../types';

/**
 * A cart line keeps the product as it was when it was added — sometimes days
 * ago. The server re-prices every line at checkout from the *current* product,
 * so a price the shop changed in the meantime used to show up only as an order
 * total that "changed by itself". This re-reads each product in the basket
 * (served from the CDN, so cheap), re-prices the lines, and returns the names
 * whose total changed so the page can say so plainly.
 */
export const useFreshPrices = (
  items: CartItem[],
  refreshProducts: (products: Product[]) => string[],
) => {
  const slugs = useMemo(() => [...new Set(items.map((i) => i.product.slug))].sort(), [items]);
  const [changed, setChanged] = useState<string[]>([]);

  const results = useQueries({
    queries: slugs.map((slug) => ({
      queryKey: ['product', slug],
      queryFn: () => productsApi.getBySlug(slug).then((r) => r.data.data as Product),
      staleTime: 60_000,
    })),
  });

  const ready = results.length > 0 && results.every((r) => r.isSuccess);
  const stamp = results.map((r) => r.dataUpdatedAt).join('|');

  useEffect(() => {
    if (!ready) return;
    // Keep only the product itself: related products and reviews would bloat
    // the cart saved in the browser.
    const fresh = results.map((r) => {
      const { related: _related, reviews: _reviews, ...product } = r.data as Product & { related?: unknown; reviews?: unknown };
      return product as Product;
    });
    const names = refreshProducts(fresh);
    if (names.length) setChanged((prev) => [...new Set([...prev, ...names])]);
    // Re-run only when fresh product data arrives, not on every re-price.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, stamp]);

  return changed;
};
