import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import WhatsAppButton from './WhatsAppButton';
import MobileTabBar from './MobileTabBar';
import { cn } from '../../lib/utils';

const Layout = () => {
  const { pathname } = useLocation();
  // Room for the phone tab bar, which checkout hides.
  const hasTabBar = !pathname.startsWith('/checkout');
  return (
    <div className={cn('min-h-screen flex flex-col bg-background', hasTabBar && 'pb-[calc(3.75rem+env(safe-area-inset-bottom))] lg:pb-0')}>
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <MobileTabBar />
      <WhatsAppButton />
    </div>
  );
};

export default Layout;
