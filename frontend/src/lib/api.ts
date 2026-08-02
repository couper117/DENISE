import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { clearAuthSession, useAuthStore } from '../store';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_URL,
  // The current backend accepts refresh tokens in the JSON body, not a cookie.
  withCredentials: false,
  headers: { 'Content-Type': 'application/json' },
});

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  skipAuthRefresh?: boolean;
}

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

let refreshPromise: Promise<RefreshResponse> | null = null;
let sessionExpiryHandled = false;

api.interceptors.request.use((config) => {
  if (config.url === '/auth/login' || config.url === '/auth/register') sessionExpiryHandled = false;
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as RetriableRequestConfig | undefined;
    const isRefreshRequest = original?.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && original && !original._retry && !original.skipAuthRefresh && !isRefreshRequest) {
      original._retry = true;
      const refreshToken = useAuthStore.getState().refreshToken;

      if (refreshToken) {
        try {
          if (!refreshPromise) {
            refreshPromise = api.post('/auth/refresh', { refreshToken }, { skipAuthRefresh: true } as RetriableRequestConfig)
              .then(({ data }) => {
                const tokens = data.data as RefreshResponse;
                useAuthStore.getState().setTokens(tokens.accessToken, tokens.refreshToken);
                sessionExpiryHandled = false;
                return tokens;
              })
              .finally(() => {
                refreshPromise = null;
              });
          }

          const tokens = await refreshPromise;
          original.headers.Authorization = `Bearer ${tokens.accessToken}`;
          return api(original);
        } catch {
          if (!sessionExpiryHandled) {
            sessionExpiryHandled = true;
            clearAuthSession();
            if (window.location.pathname !== '/login') window.location.assign('/login');
          }
        }
      } else if (!sessionExpiryHandled) {
        sessionExpiryHandled = true;
        clearAuthSession();
        if (window.location.pathname !== '/login') window.location.assign('/login');
      }
    }

    return Promise.reject(error);
  }
);

// Products
export const productsApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/products', { params }),
  getBySlug: (slug: string) => api.get(`/products/${slug}`),
  getFeatured: () => api.get('/products/featured'),
  getNewArrivals: () => api.get('/products/new-arrivals'),
  create: (data: FormData) => api.post('/products', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id: string, data: Record<string, unknown>) => api.put(`/products/${id}`, data),
  delete: (id: string) => api.delete(`/products/${id}`),
  addImages: (id: string, data: FormData) => api.post(`/products/${id}/images`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

// Categories
export const categoriesApi = {
  getAll: () => api.get('/categories'),
  create: (data: Record<string, unknown>) => api.post('/categories', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/categories/${id}`, data),
  delete: (id: string) => api.delete(`/categories/${id}`),
};

// Reservations
export const reservationsApi = {
  create: (data: Record<string, unknown>) => api.post('/reservations', data),
  track: (number: string) => api.get(`/reservations/track/${number}`),
  getMyReservations: () => api.get('/reservations/my'),
  getAll: (params?: Record<string, unknown>) => api.get('/reservations', { params }),
  updateStatus: (id: string, data: Record<string, unknown>) => api.put(`/reservations/${id}/status`, data),
  cancel: (id: string, data: Record<string, unknown>) => api.put(`/reservations/${id}/cancel`, data),
  getStats: () => api.get('/reservations/stats'),
};

// Blogs
export const blogsApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/blogs', { params }),
  getBySlug: (slug: string) => api.get(`/blogs/${slug}`),
  create: (data: FormData) => api.post('/blogs', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id: string, data: FormData) => api.put(`/blogs/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id: string) => api.delete(`/blogs/${id}`),
};

// Wishlist
export const wishlistApi = {
  getAll: () => api.get('/wishlist'),
  add: (productId: string) => api.post('/wishlist', { productId }),
  remove: (productId: string) => api.delete(`/wishlist/${productId}`),
};

// Reviews
export const reviewsApi = {
  getForProduct: (productId: string) => api.get(`/reviews/${productId}`),
  create: (data: Record<string, unknown>) => api.post('/reviews', data),
  markHelpful: (id: string) => api.post(`/reviews/${id}/helpful`),
};

// Payments
export const paymentsApi = {
  initiate: (data: Record<string, unknown>) => api.post('/payments/initiate', data),
  verify: (reference: string) => api.get(`/payments/verify/${reference}`),
  getDeliveryFees: () => api.get('/payments/delivery-fees'),
};

// Delivery
export const deliveryApi = {
  getZones: () => api.get('/delivery/zones'),
  getFee: (province: string, district?: string) => api.get('/delivery/fee', { params: { province, district } }),
  track: (reservationNumber: string) => api.get(`/delivery/track/${reservationNumber}`),
};

// Admin
export const adminApi = {
  getDashboard: () => api.get('/admin/dashboard'),
  getCustomers: (params?: Record<string, unknown>) => api.get('/admin/customers', { params }),
  toggleCustomerStatus: (id: string) => api.put(`/admin/customers/${id}/toggle-status`),
  getContent: (language?: string) => api.get('/admin/content', { params: { language } }),
  updateContent: (data: Record<string, unknown>) => api.put('/admin/content', data),
  updateSEO: (data: Record<string, unknown>) => api.put('/admin/seo', data),
  getInventory: () => api.get('/admin/inventory'),
  updateInventory: (productId: string, data: Record<string, unknown>) => api.put(`/admin/inventory/${productId}`, data),
  getBanners: () => api.get('/admin/banners'),
  createBanner: (data: FormData) => api.post('/admin/banners', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getTestimonials: () => api.get('/admin/testimonials'),
  getFAQs: () => api.get('/admin/faqs'),
  getDeliveryZones: () => api.get('/admin/delivery-zones'),
  upsertDeliveryZone: (data: Record<string, unknown>) => api.put('/admin/delivery-zones', data),
  getReviews: (params?: Record<string, unknown>) => api.get('/admin/reviews', { params }),
  approveReview: (id: string) => api.put(`/admin/reviews/${id}/approve`),
  deleteReview: (id: string) => api.delete(`/admin/reviews/${id}`),
};

// Auth
export const authApi = {
  register: (data: Record<string, unknown>) => api.post('/auth/register', data),
  login: (data: Record<string, unknown>) => api.post('/auth/login', data),
  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data: Record<string, unknown>) => api.put('/auth/profile', data),
  changePassword: (data: Record<string, unknown>) => api.put('/auth/change-password', data),
};
