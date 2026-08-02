export interface User {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  role: 'CUSTOMER' | 'ADMIN' | 'SUPER_ADMIN';
  preferredLanguage: string;
  darkMode: boolean;
  avatarUrl?: string;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  sortOrder: number;
  children?: Category[];
  _count?: { products: number };
}

export interface ProductColor {
  id: string;
  name: string;
  hexCode?: string;
  imageUrl?: string;
}

export interface ProductImage {
  id: string;
  url: string;
  altText?: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface Inventory {
  stockCount: number;
  metersAvailable?: number;
  isTracked: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  specifications?: string;
  material?: string;
  priceRange?: string;
  price?: number;
  salePrice?: number;
  pricePerMeter?: number;
  currency: string;
  isAvailable: boolean;
  isFeatured: boolean;
  isNewArrival: boolean;
  isOnPromotion: boolean;
  promotionText?: string;
  canBeDelivered: boolean;
  canBuyOnline: boolean;
  category: { id: string; name: string; slug: string };
  images: ProductImage[];
  colors: ProductColor[];
  inventory?: Inventory;
  viewCount: number;
  reservationCount: number;
  reviews?: ProductReview[];
  reviewStats?: { avg: number; count: number };
  related?: Product[];
}

export interface ProductReview {
  id: string;
  productId: string;
  userId?: string;
  customerName: string;
  rating: number;
  title?: string;
  message: string;
  isApproved: boolean;
  isVerified: boolean;
  helpfulCount: number;
  createdAt: string;
}

export type ReservationStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'PROCESSING'
  | 'PACKED'
  | 'READY_FOR_PICKUP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED';

export type FulfillmentType = 'RESERVATION' | 'PICKUP' | 'DELIVERY';

export type PaymentMethod =
  | 'MTN_MOMO'
  | 'AIRTEL_MONEY'
  | 'VISA'
  | 'MASTERCARD'
  | 'AMEX'
  | 'BANK_TRANSFER'
  | 'FLUTTERWAVE'
  | 'PAYPAL'
  | 'STRIPE'
  | 'PAY_AT_SHOP';

export type PaymentStatus = 'AWAITING' | 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

export type DeliveryType = 'SAME_DAY' | 'NEXT_DAY' | 'SCHEDULED';

export type MeasurementOption = 'KNOW_MEASUREMENTS' | 'HELP_AT_SHOP' | 'WALK_IN_CONSULTATION';

export interface DeliveryAddress {
  id?: string;
  province: string;
  district: string;
  sector?: string;
  cell?: string;
  village?: string;
  streetAddress?: string;
  latitude?: number;
  longitude?: number;
}

export interface Payment {
  id: string;
  method: PaymentMethod;
  amount: number;
  currency: string;
  status: PaymentStatus;
  reference?: string;
  phoneNumber?: string;
  createdAt: string;
}

export interface ReservationItem {
  id: string;
  productId: string;
  product: Pick<Product, 'id' | 'name' | 'images'>;
  quantity?: number;
  metersRequired?: number;
  windowWidth?: number;
  windowHeight?: number;
  unitPrice?: number;
  totalPrice?: number;
  notes?: string;
}

export interface Reservation {
  id: string;
  reservationNumber: string;
  qrCode?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  preferredLanguage: string;
  fulfillmentType: FulfillmentType;
  visitDate?: string;
  visitTime?: string;
  notes?: string;
  measurementOption: MeasurementOption;
  status: ReservationStatus;
  totalAmount?: number;
  deliveryFee?: number;
  paymentStatus: PaymentStatus;
  deliveryAddress?: DeliveryAddress;
  deliveryType?: DeliveryType;
  adminNotes?: string;
  cancelReason?: string;
  items: ReservationItem[];
  payments?: Payment[];
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  product: Product;
  quantity?: number;
  metersRequired?: number;
  windowWidth?: number;
  windowHeight?: number;
  notes?: string;
}

export interface Blog {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  imageUrl?: string;
  authorName: string;
  publishedAt?: string;
  viewCount: number;
}

export interface Testimonial {
  id: string;
  customerName: string;
  message: string;
  rating: number;
  imageUrl?: string;
}

export interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  linkUrl?: string;
  linkText?: string;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  language: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: PaginationMeta;
}
