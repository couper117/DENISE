import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Package, Calendar, Users, Warehouse, FileText, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '../../store';
import { authApi } from '../../lib/api';
import { cn } from '../../lib/utils';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, labelKey: 'admin.nav_dashboard', end: true },
  { to: '/admin/products', icon: Package, labelKey: 'admin.nav_products' },
  { to: '/admin/reservations', icon: Calendar, labelKey: 'admin.nav_reservations' },
  { to: '/admin/customers', icon: Users, labelKey: 'admin.nav_customers' },
  { to: '/admin/inventory', icon: Warehouse, labelKey: 'admin.nav_inventory' },
  { to: '/admin/content', icon: FileText, labelKey: 'admin.nav_content' },
];

const AdminLayout = () => {
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout, refreshToken } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await authApi.logout(refreshToken || '').catch(() => {});
    logout();
    navigate('/login');
  };

  const Sidebar = () => (
    <aside className={cn(
      'fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col transition-transform duration-300',
      'md:relative md:translate-x-0',
      sidebarOpen ? 'translate-x-0' : '-translate-x-full'
    )}>
      <div className="flex items-center justify-between p-6 border-b border-border">
        <div>
          <h1 className="font-serif font-bold text-primary text-lg">{t('admin.admin_title')}</h1>
          <p className="text-xs text-muted-foreground">{user?.firstName} {user?.lastName}</p>
        </div>
        <button className="md:hidden" onClick={() => setSidebarOpen(false)}>
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ to, icon: Icon, labelKey, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) =>
            cn('flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
              isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground')
          }>
            <Icon size={18} />
            {t(labelKey)}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-border">
        <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive w-full transition-colors">
          <LogOut size={18} />
          {t('admin.logout')}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-card border-b border-border px-4 md:px-6 py-4 flex items-center gap-4">
          <button className="md:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <h2 className="text-sm text-muted-foreground">{t('admin.panel')}</h2>
          <div className="ml-auto">
            <NavLink to="/" className="text-xs text-primary hover:underline">← {t('admin.view_site')}</NavLink>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
