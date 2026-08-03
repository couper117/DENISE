import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { User, CartItem, Product } from '../types';
import { Configuration, configurationKey, priceConfiguration } from '../lib/productOptions';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
  setTokens: (access: string, refresh: string) => void;
  logout: () => void;
}

type PersistedAuthState = Pick<AuthState, 'user' | 'refreshToken' | 'isAuthenticated'>;

const emptyAuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
};

const authStorageKey = 'denise-auth';

export const useAuthStore = create<AuthState>()(
  persist<AuthState, [], [], PersistedAuthState>(
    (set) => ({
      ...emptyAuthState,
      setUser: (user) => set({ user, isAuthenticated: true }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      logout: () => set(emptyAuthState),
    }),
    {
      name: authStorageKey,
      // The current API requires the refresh token in the request body. Keep it
      // only for the browser session; access tokens remain in memory.
      storage: createJSONStorage<PersistedAuthState>(() => sessionStorage),
      partialize: (state) => ({ user: state.user, refreshToken: state.refreshToken, isAuthenticated: state.isAuthenticated }),
    }
  )
);

export const clearAuthSession = () => {
  useAuthStore.setState(emptyAuthState);
  useAuthStore.persist.clearStorage();
  localStorage.removeItem(authStorageKey);
};

/**
 * The cart holds *configured* lines, not products: the same curtain ordered at
 * two different sizes is two lines. Every line therefore carries its own id,
 * its configuration, and the price estimate the customer was shown. The server
 * re-prices everything at checkout — nothing here is trusted as money.
 */
interface CartState {
  items: CartItem[];
  /** Returns the line id. Re-adding an identical configuration bumps quantity. */
  addLine: (product: Product, config: Configuration, quantity?: number) => string;
  removeLine: (lineId: string) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  updateLine: (lineId: string, config: Configuration, quantity?: number) => void;
  clearCart: () => void;
  /** Total units, so the header badge counts 3 for "3 curtains". */
  itemCount: () => number;
  /** Goods total at charged prices, ignoring lines the shop still has to quote. */
  subtotal: () => number;
  /** Savings against list price. */
  discount: () => number;
  /** True when at least one line has no price yet — the shop quotes it later. */
  hasQuotedItems: () => boolean;
}

const priceFields = (product: Product, config: Configuration, quantity: number) => {
  const priced = priceConfiguration(product, config, quantity);
  return { unitPrice: priced.unitPrice, lineTotal: priced.lineTotal, listTotal: priced.listTotal };
};

const newLineId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addLine: (product, config, quantity = 1) => {
        const qty = Math.max(1, Math.floor(quantity) || 1);
        const key = configurationKey(product.id, config);
        const existing = get().items.find((i) => configurationKey(i.product.id, i.config) === key);
        if (existing) {
          get().setQuantity(existing.id, existing.quantity + qty);
          return existing.id;
        }
        const id = newLineId();
        set((state) => ({
          items: [
            ...state.items,
            { id, product, config, quantity: qty, addedAt: new Date().toISOString(), ...priceFields(product, config, qty) },
          ],
        }));
        return id;
      },

      removeLine: (lineId) => set((state) => ({ items: state.items.filter((i) => i.id !== lineId) })),

      setQuantity: (lineId, quantity) => set((state) => ({
        items: state.items.map((i) =>
          i.id === lineId
            ? { ...i, quantity: Math.max(1, Math.floor(quantity) || 1), ...priceFields(i.product, i.config, Math.max(1, Math.floor(quantity) || 1)) }
            : i
        ),
      })),

      updateLine: (lineId, config, quantity) => set((state) => ({
        items: state.items.map((i) => {
          if (i.id !== lineId) return i;
          const qty = quantity != null ? Math.max(1, Math.floor(quantity) || 1) : i.quantity;
          return { ...i, config, quantity: qty, ...priceFields(i.product, config, qty) };
        }),
      })),

      clearCart: () => set({ items: [] }),

      itemCount: () => get().items.reduce((n, i) => n + i.quantity, 0),
      subtotal: () => get().items.reduce((sum, i) => sum + (i.lineTotal ?? 0), 0),
      discount: () => Math.max(0, get().items.reduce((sum, i) => sum + ((i.listTotal ?? 0) - (i.lineTotal ?? 0)), 0)),
      hasQuotedItems: () => get().items.some((i) => i.lineTotal == null),
    }),
    {
      name: 'denise-cart',
      version: 2,
      /**
       * Version 1 kept one entry per product keyed by product id, with loose
       * `quantity`/`metersRequired`/`windowWidth` fields. Those carts are still
       * sitting in customers' browsers, so they are converted rather than
       * dropped — losing someone's cart on deploy day is exactly the kind of
       * thing this refactor is meant to prevent.
       */
      migrate: (persisted, version) => {
        if (version >= 2 || !persisted) return persisted as { items: CartItem[] };
        const legacy = (persisted as { items?: LegacyCartItem[] }).items ?? [];
        const items: CartItem[] = legacy
          .filter((i) => i?.product?.id)
          .map((i) => {
            const config: Configuration = {
              widthCm: i.windowWidth,
              dropCm: i.windowHeight,
              meters: i.metersRequired,
              notes: i.notes,
            };
            const quantity = Math.max(1, Math.floor(i.quantity ?? 1) || 1);
            return {
              id: newLineId(),
              product: i.product,
              config,
              quantity,
              addedAt: new Date().toISOString(),
              ...priceFields(i.product, config, quantity),
            };
          });
        return { items } as { items: CartItem[] };
      },
    }
  )
);

/** Shape of a cart line as persisted before version 2. */
interface LegacyCartItem {
  product: Product;
  quantity?: number;
  metersRequired?: number;
  windowWidth?: number;
  windowHeight?: number;
  notes?: string;
}

interface ThemeState {
  isDark: boolean;
  language: string;
  toggleTheme: () => void;
  setLanguage: (lang: string) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      isDark: false,
      language: 'en',
      toggleTheme: () => set((state) => ({ isDark: !state.isDark })),
      setLanguage: (language) => set({ language }),
    }),
    { name: 'denise-theme' }
  )
);
