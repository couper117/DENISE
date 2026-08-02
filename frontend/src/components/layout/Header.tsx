import { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShoppingBag, Heart, User, Menu, X, Sun, Moon, Globe, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore, useCartStore, useThemeStore } from '../../store';
import { cn } from '../../lib/utils';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'rw', label: 'Kinyarwanda', flag: '🇷🇼' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'sw', label: 'Kiswahili', flag: '🇰🇪' },
  { code: 'ln', label: 'Lingala', flag: '🇨🇩' },
];

const Header = () => {
  const { t, i18n } = useTranslation();
  const { isAuthenticated, user } = useAuthStore();
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

  const navLinks = [
    { to: '/', label: t('nav.home'), end: true },
    { to: '/products', label: t('nav.products') },
    { to: '/reservation', label: t('nav.reservation') },
    { to: '/about', label: t('nav.about') },
    { to: '/blog', label: t('nav.blog') },
    { to: '/contact', label: t('nav.contact') },
  ];

  return (
    <header className={cn(
      'sticky top-0 z-50 transition-all duration-300',
      scrolled ? 'bg-card/95 backdrop-blur-md shadow-sm border-b border-border' : 'bg-card border-b border-border'
    )}>
      {/* Top bar */}
      <div className="bg-primary text-primary-foreground py-1.5 text-center text-xs">
        <span>{t('header.announcement')}</span>
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
            {navLinks.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) =>
                cn('px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-accent')
              }>
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1">
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
              <div className="relative group">
                <button className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-accent transition-colors">
                  <div className="w-7 h-7 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                    {user?.firstName[0]}{user?.lastName[0]}
                  </div>
                </button>
                <div className="absolute right-0 top-10 bg-card border border-border rounded-lg shadow-lg py-1 w-44 z-50 hidden group-hover:block">
                  {user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' ? (
                    <Link to="/admin" className="block px-4 py-2 text-sm hover:bg-accent">{t('header.admin_panel')}</Link>
                  ) : null}
                  <Link to="/account/profile" className="block px-4 py-2 text-sm hover:bg-accent">{t('account.profile')}</Link>
                  <Link to="/account/reservations" className="block px-4 py-2 text-sm hover:bg-accent">{t('account.reservations')}</Link>
                  <Link to="/account/wishlist" className="block px-4 py-2 text-sm hover:bg-accent">{t('account.wishlist')}</Link>
                </div>
              </div>
            ) : (
              <Link to="/login" className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors">
                <User size={15} />
                {t('nav.login')}
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
                {navLinks.map(({ to, label, end }) => (
                  <NavLink key={to} to={to} end={end} onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      cn('block px-4 py-2.5 text-sm font-medium rounded-md transition-colors',
                        isActive ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-accent')}>
                    {label}
                  </NavLink>
                ))}
                {!isAuthenticated && (
                  <div className="pt-2 px-4 flex gap-2">
                    <Link to="/login" onClick={() => setMenuOpen(false)} className="flex-1 text-center py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md">{t('nav.login')}</Link>
                    <Link to="/register" onClick={() => setMenuOpen(false)} className="flex-1 text-center py-2 border border-primary text-primary text-sm font-medium rounded-md">{t('nav.register')}</Link>
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
