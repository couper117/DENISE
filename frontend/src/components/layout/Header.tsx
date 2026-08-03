import { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShoppingBag, Heart, User, Menu, X, Sun, Moon, Globe, Search, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { clearAuthSession, useAuthStore, useCartStore, useThemeStore } from '../../store';
import { authApi } from '../../lib/api';
import { cn } from '../../lib/utils';
import { EditWebsiteButton, EditableText } from '../../cms';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'rw', label: 'Kinyarwanda', flag: '🇷🇼' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'sw', label: 'Kiswahili', flag: '🇰🇪' },
  { code: 'ln', label: 'Lingala', flag: '🇨🇩' },
];

const Header = () => {
  const { t, i18n } = useTranslation();
  const { isAuthenticated, user, refreshToken } = useAuthStore();
  const { itemCount } = useCartStore();
  const { isDark, toggleTheme, setLanguage } = useThemeStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const changeLanguage = (code: string) => {
    i18n.changeLanguage(code);
    setLanguage(code);
    setLangMenuOpen(false);
  };

  const handleLogout = async () => {
    await authApi.logout(refreshToken || '').catch(() => {});
    clearAuthSession();
    setMenuOpen(false);
    navigate('/login');
  };

  // Keys rather than resolved strings, so each nav label is editable in place.
  const navLinks = [
    { to: '/', labelKey: 'nav.home', end: true },
    { to: '/products', labelKey: 'nav.products' },
    { to: '/reservation', labelKey: 'nav.reservation' },
    { to: '/about', labelKey: 'nav.about' },
    { to: '/blog', labelKey: 'nav.blog' },
    { to: '/contact', labelKey: 'nav.contact' },
  ];

  return (
    <header className={cn(
      'sticky top-0 z-50 transition-all duration-300',
      scrolled ? 'bg-card/95 backdrop-blur-md shadow-sm border-b border-border' : 'bg-card border-b border-border'
    )}>
      {/* Top bar */}
      <div className="bg-primary text-primary-foreground py-1.5 text-center text-xs">
        <EditableText id="header.announcement" label="Announcement bar" />
      </div>

      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">D</span>
            </div>
            <div className="hidden sm:block">
              <span className="font-serif font-bold text-primary text-lg leading-none block">DENISE</span>
              <span className="text-xs text-muted-foreground leading-none">Textile</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map(({ to, labelKey, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) =>
                cn('px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-accent')
              }>
                <EditableText id={labelKey} />
              </NavLink>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {/* Visual CMS. Renders nothing unless the signed-in user is an admin. */}
            <EditWebsiteButton className="mr-1" />

            {/* Search */}
            <button onClick={() => navigate('/products')} className="p-2 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
              <Search size={18} />
            </button>

            {/* Language */}
            <div className="relative">
              <button onClick={() => setLangMenuOpen(!langMenuOpen)} className="p-2 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
                <Globe size={18} />
              </button>
              <AnimatePresence>
                {langMenuOpen && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className="absolute right-0 top-10 bg-card border border-border rounded-lg shadow-lg py-1 w-44 z-50">
                    {LANGUAGES.map((lang) => (
                      <button key={lang.code} onClick={() => changeLanguage(lang.code)}
                        className={cn('w-full text-left px-4 py-2 text-sm hover:bg-accent flex items-center gap-2',
                          i18n.language === lang.code && 'bg-primary/10 text-primary font-medium')}>
                        <span>{lang.flag}</span>
                        {lang.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Theme */}
            <button onClick={toggleTheme} className="p-2 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Cart */}
            <Link to="/reservation" className="relative p-2 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
              <ShoppingBag size={18} />
              {itemCount() > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center font-bold">
                  {itemCount()}
                </span>
              )}
            </Link>

            {/* Account */}
            {isAuthenticated ? (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button aria-label="Open account menu" className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-accent transition-colors">
                  <div className="w-7 h-7 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                    {user?.firstName[0]}{user?.lastName[0]}
                  </div>
                </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content align="end" sideOffset={8} className="bg-card border border-border rounded-lg shadow-lg py-1 w-44 z-50">
                  {user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' ? (
                    <DropdownMenu.Item asChild><Link to="/admin" className="block px-4 py-2 text-sm outline-none hover:bg-accent focus:bg-accent"><EditableText id="header.admin_panel" /></Link></DropdownMenu.Item>
                  ) : null}
                  <DropdownMenu.Item asChild><Link to="/account/profile" className="block px-4 py-2 text-sm outline-none hover:bg-accent focus:bg-accent"><EditableText id="account.profile" /></Link></DropdownMenu.Item>
                  <DropdownMenu.Item asChild><Link to="/account/reservations" className="block px-4 py-2 text-sm outline-none hover:bg-accent focus:bg-accent"><EditableText id="account.reservations" /></Link></DropdownMenu.Item>
                  <DropdownMenu.Item asChild><Link to="/account/wishlist" className="block px-4 py-2 text-sm outline-none hover:bg-accent focus:bg-accent"><EditableText id="account.wishlist" /></Link></DropdownMenu.Item>
                  <DropdownMenu.Separator className="my-1 h-px bg-border" />
                  <DropdownMenu.Item onSelect={handleLogout} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-destructive outline-none hover:bg-destructive/10 focus:bg-destructive/10 cursor-pointer">
                    <LogOut size={15} /> <EditableText id="admin.logout" />
                  </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            ) : (
              <Link to="/login" className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors">
                <User size={15} />
                <EditableText id="nav.login" />
              </Link>
            )}

            {/* Mobile menu toggle */}
            <button className="lg:hidden p-2 rounded-md hover:bg-accent transition-colors" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        <AnimatePresence>
          {menuOpen && (
            <motion.nav initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="lg:hidden overflow-hidden border-t border-border">
              <div className="py-4 space-y-1">
                {navLinks.map(({ to, labelKey, end }) => (
                  <NavLink key={to} to={to} end={end} onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      cn('block px-4 py-2.5 text-sm font-medium rounded-md transition-colors',
                        isActive ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-accent')}>
                    <EditableText id={labelKey} />
                  </NavLink>
                ))}
                {!isAuthenticated && (
                  <div className="pt-2 px-4 flex gap-2">
                    <Link to="/login" onClick={() => setMenuOpen(false)} className="flex-1 text-center py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md"><EditableText id="nav.login" /></Link>
                    <Link to="/register" onClick={() => setMenuOpen(false)} className="flex-1 text-center py-2 border border-primary text-primary text-sm font-medium rounded-md"><EditableText id="nav.register" /></Link>
                  </div>
                )}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
};

export default Header;
