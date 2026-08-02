import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useThemeStore, useAuthStore } from './store';
import { Toaster } from './components/ui/Toaster';
import Layout from './components/layout/Layout';
import AdminLayout from './components/layout/AdminLayout';
import LoadingSpinner from './components/ui/LoadingSpinner';
import Analytics from './components/Analytics';

// Public pages
const Home = lazy(() => import('./pages/Home'));
const Products = lazy(() => import('./pages/Products'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Reservation = lazy(() => import('./pages/Reservation'));
const ReservationTracking = lazy(() => import('./pages/ReservationTracking'));
const About = lazy(() => import('./pages/About'));
const Blog = lazy(() => import('./pages/Blog'));
const BlogPost = lazy(() => import('./pages/BlogPost'));
const Contact = lazy(() => import('./pages/Contact'));

// Auth pages
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));

// Account pages
const Profile = lazy(() => import('./pages/account/Profile'));
const ReservationHistory = lazy(() => import('./pages/account/ReservationHistory'));
const Wishlist = lazy(() => import('./pages/account/Wishlist'));

// Admin pages
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'));
const AdminReservations = lazy(() => import('./pages/admin/AdminReservations'));
const AdminCustomers = lazy(() => import('./pages/admin/AdminCustomers'));
const AdminInventory = lazy(() => import('./pages/admin/AdminInventory'));
const AdminContent = lazy(() => import('./pages/admin/AdminContent'));

const ProtectedRoute = ({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (adminOnly && user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') return <Navigate to="/" replace />;
  return <>{children}</>;
};

const App = () => {
  const { isDark } = useThemeStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  return (
    <BrowserRouter>
      <Analytics />
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" /></div>}>
        <Routes>
          {/* Public Layout */}
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/products" element={<Products />} />
            <Route path="/products/:slug" element={<ProductDetail />} />
            <Route path="/reservation" element={<Reservation />} />
            <Route path="/track" element={<ReservationTracking />} />
            <Route path="/about" element={<About />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected Customer Routes */}
            <Route path="/account/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/account/reservations" element={<ProtectedRoute><ReservationHistory /></ProtectedRoute>} />
            <Route path="/account/wishlist" element={<ProtectedRoute><Wishlist /></ProtectedRoute>} />
          </Route>

          {/* Admin Layout */}
          <Route path="/admin" element={<ProtectedRoute adminOnly><AdminLayout /></ProtectedRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="reservations" element={<AdminReservations />} />
            <Route path="customers" element={<AdminCustomers />} />
            <Route path="inventory" element={<AdminInventory />} />
            <Route path="content" element={<AdminContent />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toaster />
    </BrowserRouter>
  );
};

export default App;
