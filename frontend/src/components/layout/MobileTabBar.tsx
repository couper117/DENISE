import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, LayoutGrid, MessageCircle, ShoppingBag, User } from 'lucide-react';
import { useAuthStore, useCartStore } from '../../store';
import { WHATSAPP_LINK } from '../../lib/config';
import { cn } from '../../lib/utils';

/** Routes where the bar would get in the way of a focused task. */
const HIDDEN_ON = ['/checkout'];

/**
 * App-style bottom navigation for phones. Replaces the floating WhatsApp
 * bubble below `lg` (it covered prices and buttons) and keeps the cart one tap
 * away from anywhere. Hidden on checkout so paying has no distractions.
 */
const MobileTabBar = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const count = useCartStore((s) => s.itemCount());
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  const item = 'relative flex flex-1 flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 text-[10.5px] font-medium transition-colors';
  const tab = ({ isActive }: { isActive: boolean }) => cn(item, isActive ? 'text-primary' : 'text-foreground/60');

  return (
    <nav
      aria-label={t('nav.mobile_tabs', { defaultValue: 'Main navigation' })}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <div className="mx-auto flex max-w-md">
        <NavLink to="/" end className={tab}><Home size={21} />{t('nav.home')}</NavLink>
        <NavLink to="/products" className={tab}><LayoutGrid size={21} />{t('nav.shop', { defaultValue: 'Shop' })}</NavLink>
        <NavLink to="/cart" className={tab}>
          <span className="relative">
            <ShoppingBag size={21} />
            {count > 0 && (
              <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground ring-2 ring-background">
                {count}
              </span>
            )}
          </span>
          {t('nav.cart')}
        </NavLink>
        <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className={cn(item, 'text-[#1f8f4e]')}>
          <MessageCircle size={21} />{t('nav.chat', { defaultValue: 'Chat' })}
        </a>
        <NavLink to={isAuthenticated ? '/account/profile' : '/login'} className={tab}>
          <User size={21} />{isAuthenticated ? t('nav.account') : t('nav.login')}
        </NavLink>
      </div>
    </nav>
  );
};

export default MobileTabBar;
