import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, CartItem, Product } from '../types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
  setTokens: (access: string, refresh: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: true }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      logout: () => set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false }),
    }),
    {
      name: 'denise-auth',
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken, refreshToken: state.refreshToken, isAuthenticated: state.isAuthenticated }),
    }
  )
);

interface CartState {
  items: CartItem[];
  addItem: (product: Product, options?: Partial<Omit<CartItem, 'product'>>) => void;
  removeItem: (productId: string) => void;
  updateItem: (productId: string, updates: Partial<CartItem>) => void;
  clearCart: () => void;
  itemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (product, options = {}) => {
        const existing = get().items.find((i) => i.product.id === product.id);
        if (existing) return;
        set((state) => ({ items: [...state.items, { product, ...options }] }));
      },
      removeItem: (productId) => set((state) => ({ items: state.items.filter((i) => i.product.id !== productId) })),
      updateItem: (productId, updates) => set((state) => ({ items: state.items.map((i) => i.product.id === productId ? { ...i, ...updates } : i) })),
      clearCart: () => set({ items: [] }),
      itemCount: () => get().items.length,
    }),
    { name: 'denise-cart' }
  )
);

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
