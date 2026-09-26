import { useState, useEffect, FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ShoppingBag, Heart, User, Menu, X, Sun, Moon, Globe, Search, LogOut, Phone, ChevronDown, ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { clearAuthSession, useAuthStore, useCartStore, useThemeStore } from '../../store';
import { authApi } from '../../lib/api';
import { cn } from '../../lib/utils';
import { BUSINESS_PHONE, BUSINESS_PHONE_CLEAN } from '../../lib/config';
import { EditWebsiteButton, EditableText, useCmsStore, useCmsValue } from '../../cms';

const LANGUAGES = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'rw', label: 'Kinyarwanda', short: 'RW' },
  { code: 'fr', label: 'Français', short: 'FR' },
  { code: 'sw', label: 'Kiswahili', short: 'SW' },
  { code: 'ln', label: 'Lingala', short: 'LN' },
];

/* What the shop sells, on every page. The whole point of the category bar is
   that a first-time visitor can see the range without opening a menu. Keys
   rather than strings so each label stays editable in place; the category
   names reuse the homepage collection keys so they read the same everywhere. */
const CATEGORY_LINKS = [
  { to: '/products', labelKey: 'nav.shop_all' },
  { to: '/products?category=curtains', labelKey: 'home.cat_curtains_name' },
  { to: '/products?category=fabrics', labelKey: 'home.cat_fabrics_name' },
  { to: '/products?category=traditional-attire', labelKey: 'home.cat_traditional_name' },
  { to: '/products?category=accessories', labelKey: 'home.cat_accessories_name' },
  { to: '/products?newArrival=true', labelKey: 'home.new_arrivals' },
];

// No "Reserve" entry: reserving is one of the fulfilment choices at checkout,
// and /reservation redirects to the cart.
const PAGE_LINKS = [
  { to: '/about', labelKey: 'nav.about' },
  { to: '/blog', labelKey: 'nav.blog' },
  { to: '/contact', labelKey: 'nav.contact' },
  { to: '/track', labelKey: 'nav.track' },
];

/** A category link is active when both the path and the query match, so
 *  "Curtains" is not highlighted while browsing "Fabrics". */
const useIsCategoryActive = () => {
  const { pathname, search } = useLocation();
  return (to: string) => {
    const [path, query = ''] = to.split('?');
    return pathname === path && new URLSearchParams(search).toString() === new URLSearchParams(query).toString();
  };
};

const SearchForm = ({ className, autoFocus, onDone }: { className?: string; autoFocus?: boolean; onDone?: () => void }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/products?search=${encodeURIComponent(term)}` : '/products');
    setQ('');
    onDone?.();
  };

  return (
    <form role="search" onSubmit={submit} className={cn('relative', className)}>
      <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus={autoFocus}
        placeholder={t('header.search_placeholder')}
        aria-label={t('header.search_placeholder')}
        className="h-11 w-full rounded-full border border-input bg-muted/50 pl-11 pr-4 text-sm placeholder:text-muted-foreground/80 transition-colors focus:border-primary/40 focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/15"
      />
    </form>
  );
};

/**
 * Phones get one announcement message at a time, rotating, instead of the full
 * line wrapping onto two rows. Messages are the admin's announcement split on
 * "•"; in edit mode the full editable text is shown so it can be changed.
 */
const MobileAnnouncement = () => {
  const text = useCmsValue<string>('header.announcement', 'TEXT', '');
  const editing = useCmsStore((s) => s.editMode);
  const parts = text.split(/\s*[•·|]\s*/).map((p) => p.trim()).filter(Boolean);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (parts.length < 2) return;
    const id = setInterval(() => setI((n) => (n + 1) % parts.length), 3500);
    return () => clearInterval(id);
  }, [parts.length]);
  if (editing || parts.length < 2) return <EditableText id="header.announcement" label="Announcement bar" className="text-center md:hidden" />;
  return (
    <span className="relative block h-4 w-full overflow-hidden text-center md:hidden" aria-live="off">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={i} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: 0.3 }} className="absolute inset-0">
          {parts[i % parts.length]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

const LanguageMenu = ({ tone = 'bar' }: { tone?: 'bar' | 'panel' }) => {
  const { i18n } = useTranslation();
  const { setLanguage } = useThemeStore();
  const current = LANGUAGES.find((l) => i18n.language?.startsWith(l.code)) ?? LANGUAGES[0];

  const change = (code: string) => {
    i18n.changeLanguage(code);
    setLanguage(code);
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          aria-label={`Language: ${current.label}`}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full text-xs font-medium transition-colors',
            tone === 'bar'
              ? 'px-2 py-1 text-white/80 hover:text-white dark:text-muted-foreground dark:hover:text-foreground'
              : 'h-10 border border-border px-4 hover:bg-accent'
          )}
        >
          <Globe size={14} /> {tone === 'bar' ? current.short : current.label} <ChevronDown size={12} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className="z-[60] w-44 rounded-xl border border-border bg-popover p-1 shadow-lift">
          {LANGUAGES.map((lang) => (
            <DropdownMenu.Item
              key={lang.code}
              onSelect={() => change(lang.code)}
              className={cn(
                'flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm outline-none hover:bg-accent focus:bg-accent',
                current.code === lang.code && 'font-semibold text-primary'
              )}
            >
              {lang.label} <span className="text-xs text-muted-foreground">{lang.short}</span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

const Header = () => {
  const { t } = useTranslation();
  const { isAuthenticated, user, refreshToken } = useAuthStore();
  const { itemCount } = useCartStore();
  const { isDark, toggleTheme } = useThemeStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isCategoryActive = useIsCategoryActive();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const count = itemCount();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8);
    handler();
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Any navigation closes the mobile panels.
  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname, location.search]);

  // The drawer covers the page; the page behind it must not scroll.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const handleLogout = async () => {
    await authApi.logout(refreshToken || '').catch(() => {});
    clearAuthSession();
    setMenuOpen(false);
    navigate('/login');
  };

  const menuItemClass = 'block rounded-lg px-3 py-2 text-sm outline-none hover:bg-accent focus:bg-accent';

  return (
    <header className={cn(
      'sticky top-0 z-50 border-b bg-background/90 backdrop-blur-md transition-shadow duration-300',
      scrolled ? 'border-border shadow-soft' : 'border-transparent'
    )}>
      {/* Top bar. Dark ink on light pages; on dark pages a solid bar would be
          the brightest thing on screen, so it drops to the card surface. */}
      <div className="bg-brand-dark text-white/85 dark:bg-card dark:text-muted-foreground dark:border-b dark:border-border">
        <div className="shop-container flex h-8 items-center justify-center gap-4 text-[11px] sm:text-xs md:h-9 md:justify-between">
          <a href={`tel:+${BUSINESS_PHONE_CLEAN}`} className="hidden items-center gap-1.5 hover:text-white dark:hover:text-foreground md:inline-flex">
            <Phone size={13} /> {BUSINESS_PHONE}
          </a>
          <MobileAnnouncement />
          <EditableText id="header.announcement" label="Announcement bar" className="hidden truncate text-center md:block" />
          <div className="hidden items-center gap-1 md:flex">
            <LanguageMenu />
            <button
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="rounded-full p-1.5 text-white/80 transition-colors hover:text-white dark:text-muted-foreground dark:hover:text-foreground"
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </div>
      </div>

      {/* Main row */}
      <div className="shop-container">
        <div className="flex h-16 items-center gap-3 md:h-20 md:gap-6">
          <button className="icon-btn -ml-2 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Menu size={21} />
          </button>

          <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="DENISE Textile — home">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-serif text-lg font-semibold text-primary-foreground md:h-10 md:w-10">
              D
            </span>
            <span className="leading-none">
              <span className="block font-serif text-xl font-semibold tracking-tight md:text-2xl">DENISE</span>
              <span className="mt-0.5 hidden text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground sm:block">
                Textile · Kigali
              </span>
            </span>
          </Link>

          <SearchForm className="mx-auto hidden w-full max-w-xl md:block" />

          <div className="ml-auto flex items-center gap-0.5 md:ml-0">
            <EditWebsiteButton className="mr-1" />

            <button className="icon-btn md:hidden" onClick={() => setSearchOpen((v) => !v)} aria-label={t('header.search_placeholder')}>
              {searchOpen ? <X size={20} /> : <Search size={20} />}
            </button>

            {isAuthenticated && (
              <Link to="/account/wishlist" className="icon-btn hidden sm:inline-flex" aria-label={t('nav.wishlist')}>
                <Heart size={20} />
              </Link>
            )}

            {isAuthenticated ? (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button aria-label="Open account menu" className="icon-btn">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-[11px] font-bold text-background">
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </span>
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content align="end" sideOffset={8} className="z-[60] w-52 rounded-xl border border-border bg-popover p-1 shadow-lift">
                    <div className="px-3 py-2 text-xs text-muted-foreground">{user?.firstName} {user?.lastName}</div>
                    {isAdmin && (
                      <DropdownMenu.Item asChild><Link to="/admin" className={menuItemClass}><EditableText id="header.admin_panel" /></Link></DropdownMenu.Item>
                    )}
                    <DropdownMenu.Item asChild><Link to="/account/profile" className={menuItemClass}><EditableText id="account.profile" /></Link></DropdownMenu.Item>
                    <DropdownMenu.Item asChild><Link to="/account/reservations" className={menuItemClass}><EditableText id="account.reservations" /></Link></DropdownMenu.Item>
                    <DropdownMenu.Item asChild><Link to="/account/wishlist" className={menuItemClass}><EditableText id="account.wishlist" /></Link></DropdownMenu.Item>
                    <DropdownMenu.Separator className="my-1 h-px bg-border" />
                    <DropdownMenu.Item onSelect={handleLogout} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive outline-none hover:bg-destructive/10 focus:bg-destructive/10">
                      <LogOut size={15} /> <EditableText id="admin.logout" />
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            ) : (
              <Link to="/login" className="icon-btn hidden w-auto gap-2 px-3 text-sm font-medium sm:inline-flex" aria-label={t('nav.login')}>
                <User size={20} /> <span className="hidden xl:inline"><EditableText id="nav.login" /></span>
              </Link>
            )}

            <Link to="/cart" aria-label={`${t('nav.cart')} (${count})`} className="icon-btn">
              <ShoppingBag size={20} />
              {count > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground ring-2 ring-background">
                  {count}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Mobile search, revealed from the icon. */}
        <AnimatePresence initial={false}>
          {searchOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden md:hidden">
              <SearchForm autoFocus className="pb-3" onDone={() => setSearchOpen(false)} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category chips — phones and tablets. The range has to be visible
            without opening the menu, so it scrolls sideways under the logo. */}
        {!location.pathname.startsWith('/checkout') && <nav aria-label="Shop categories" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:hidden [&::-webkit-scrollbar]:hidden">
          {CATEGORY_LINKS.map(({ to, labelKey }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                isCategoryActive(to)
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-card text-foreground/80 hover:border-foreground/30'
              )}
            >
              <EditableText id={labelKey} />
            </Link>
          ))}
        </nav>}

        {/* Category bar — desktop */}
        <nav aria-label="Shop categories" className="hidden h-12 items-center justify-between border-t border-border/70 lg:flex">
          <ul className="flex items-center gap-1">
            {CATEGORY_LINKS.map(({ to, labelKey }) => (
              <li key={to}>
                <Link
                  to={to}
                  className={cn(
                    'relative inline-flex h-12 items-center px-3 text-sm font-medium transition-colors',
                    isCategoryActive(to) ? 'text-foreground' : 'text-foreground/70 hover:text-foreground'
                  )}
                >
                  <EditableText id={labelKey} />
                  {isCategoryActive(to) && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />}
                </Link>
              </li>
            ))}
          </ul>
          <ul className="flex items-center gap-1">
            {PAGE_LINKS.map(({ to, labelKey }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) => cn(
                    'inline-flex h-12 items-center px-3 text-sm transition-colors',
                    isActive ? 'font-medium text-primary' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <EditableText id={labelKey} />
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Mobile drawer. Portalled to <body>: the header's backdrop-filter makes
          it the containing block for fixed children, which would clip the
          drawer to the header's own height. */}
      {createPortal(<AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[2px] lg:hidden"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="fixed inset-y-0 left-0 z-[80] flex w-[86%] max-w-sm flex-col bg-background shadow-lift lg:hidden"
            >
              <div className="flex h-16 items-center justify-between border-b border-border px-4">
                <span className="font-serif text-xl font-semibold">DENISE</span>
                <button className="icon-btn" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={20} /></button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-5">
                <SearchForm onDone={() => setMenuOpen(false)} />

                <p className="eyebrow mt-7 mb-2 px-1"><EditableText id="footer.products" /></p>
                <ul>
                  {CATEGORY_LINKS.map(({ to, labelKey }) => (
                    <li key={to}>
                      <Link
                        to={to}
                        className={cn(
                          'flex items-center justify-between rounded-xl px-3 py-3 text-base font-medium transition-colors hover:bg-accent',
                          isCategoryActive(to) && 'bg-accent text-primary'
                        )}
                      >
                        <EditableText id={labelKey} /> <ChevronRight size={16} className="text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>

                <p className="eyebrow mt-7 mb-2 px-1"><EditableText id="footer.company" /></p>
                <ul>
                  {[{ to: '/', labelKey: 'nav.home' }, ...PAGE_LINKS].map(({ to, labelKey }) => (
                    <li key={to}>
                      <NavLink
                        to={to}
                        end={to === '/'}
                        className={({ isActive }) => cn('block rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-accent', isActive ? 'font-medium text-primary' : 'text-foreground/80')}
                      >
                        <EditableText id={labelKey} />
                      </NavLink>
                    </li>
                  ))}
                  {isAuthenticated && (
                    <>
                      <li><Link to="/account/reservations" className="block rounded-xl px-3 py-2.5 text-sm text-foreground/80 hover:bg-accent"><EditableText id="account.reservations" /></Link></li>
                      <li><Link to="/account/wishlist" className="block rounded-xl px-3 py-2.5 text-sm text-foreground/80 hover:bg-accent"><EditableText id="account.wishlist" /></Link></li>
                    </>
                  )}
                </ul>

                <div className="mt-7 flex items-center gap-2">
                  <LanguageMenu tone="panel" />
                  <button onClick={toggleTheme} className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-xs font-medium hover:bg-accent">
                    {isDark ? <Sun size={14} /> : <Moon size={14} />} {isDark ? 'Light' : 'Dark'}
                  </button>
                </div>
              </div>

              <div className="border-t border-border p-4">
                {isAuthenticated ? (
                  <button onClick={handleLogout} className="btn btn-outline w-full text-destructive">
                    <LogOut size={16} /> <EditableText id="admin.logout" />
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Link to="/login" className="btn btn-primary"><EditableText id="nav.login" /></Link>
                    <Link to="/register" className="btn btn-outline"><EditableText id="nav.register" /></Link>
                  </div>
                )}
                <a href={`tel:+${BUSINESS_PHONE_CLEAN}`} className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Phone size={14} /> {BUSINESS_PHONE}
                </a>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>, document.body)}
    </header>
  );
};

export default Header;
