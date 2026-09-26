import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Package, Calendar, Users, Warehouse, FileText, LogOut, Menu, X, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store';
import { authApi } from '../../lib/api';
import { cn } from '../../lib/utils';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, labelKey: 'admin.nav_dashboard', fallback: 'Dashboard', end: true },
  { to: '/admin/products', icon: Package, labelKey: 'admin.nav_products', fallback: 'Products' },
  { to: '/admin/reservations', icon: Calendar, labelKey: 'admin.nav_reservations', fallback: 'Reservations' },
  { to: '/admin/customers', icon: Users, labelKey: 'admin.nav_customers', fallback: 'Customers' },
  { to: '/admin/inventory', icon: Warehouse, labelKey: 'admin.nav_inventory', fallback: 'Inventory' },
  { to: '/admin/content', icon: FileText, labelKey: 'admin.nav_content', fallback: 'Content' },
];

/** The four sections the owner uses most get a bottom tab bar on phones. */
const tabItems = navItems.slice(0, 4);

const AdminLayout = () => {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout, refreshToken } = useAuthStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Close the phone menu whenever the admin moves to another section.
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [menuOpen]);

  const handleLogout = async () => {
    await authApi.logout(refreshToken || '').catch(() => {});
    logout();
    navigate('/login');
  };

  const current = [...navItems].reverse().find((i) => (i.end ? pathname === i.to || pathname === `${i.to}/` : pathname.startsWith(i.to)));
  const label = (i: (typeof navItems)[number]) => t(i.labelKey, { defaultValue: i.fallback });
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || 'A';

  const viewSite = (className?: string) => (
    <a href="/" target="_blank" rel="noreferrer" className={className}>
      <ExternalLink size={16} />
      {t('admin.view_website', { defaultValue: 'View website' })}
    </a>
  );

  const sidebar = (
    <aside
      id="admin-sidebar"
      className={cn(
        'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border bg-card transition-transform duration-300',
        'lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:translate-x-0',
        menuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
      )}
      aria-label={t('admin.menu', { defaultValue: 'Admin menu' })}
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <Link to="/admin" className="min-w-0">
          <p className="font-serif text-lg font-bold text-primary">{t('admin.admin_title', { defaultValue: 'DENISE Admin' })}</p>
          <p className="truncate text-xs text-muted-foreground">{t('admin.panel', { defaultValue: 'Administration Panel' })}</p>
        </Link>
        <button type="button" className="icon-btn lg:hidden" onClick={() => setMenuOpen(false)} aria-label={t('admin.close_menu', { defaultValue: 'Close menu' })}>
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cn(
              'relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary/10 text-primary before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}>
              <Icon size={18} />
              {label(item)}
            </NavLink>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {viewSite('flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground')}
        <div className="flex items-center gap-3 rounded-xl px-4 py-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">{initials}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.firstName} {user?.lastName}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email || user?.phone}</p>
          </div>
        </div>
        <button type="button" onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
          <LogOut size={18} />
          {t('admin.logout', { defaultValue: 'Logout' })}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {sidebar}
      {menuOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMenuOpen(false)} aria-hidden="true" />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-card/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4 md:px-6">
            <button type="button" className="icon-btn lg:hidden" onClick={() => setMenuOpen(true)}
              aria-label={t('admin.open_menu', { defaultValue: 'Open menu' })} aria-expanded={menuOpen} aria-controls="admin-sidebar">
              <Menu size={20} />
            </button>
            <div className="min-w-0">
              <p className="hidden text-xs text-muted-foreground sm:block">{t('admin.panel', { defaultValue: 'Administration Panel' })}</p>
              <h2 className="truncate text-sm font-semibold sm:text-base">{current ? label(current) : t('admin.admin_title', { defaultValue: 'DENISE Admin' })}</h2>
            </div>
            <div className="ml-auto">
              {viewSite('btn btn-outline btn-sm !px-3')}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 pb-24 md:p-6 lg:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Phone / tablet: bottom tab bar for the main sections, "More" opens the full menu. */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label={t('admin.quick_nav', { defaultValue: 'Quick navigation' })}>
        <div className="grid grid-cols-5">
          {tabItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cn(
                'flex flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}>
                <Icon size={20} />
                <span className="max-w-full truncate">{label(item)}</span>
              </NavLink>
            );
          })}
          <button type="button" onClick={() => setMenuOpen(true)}
            className={cn('flex flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-medium transition-colors',
              current && !tabItems.includes(current) ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>
            <Menu size={20} />
            <span>{t('admin.more', { defaultValue: 'More' })}</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default AdminLayout;
