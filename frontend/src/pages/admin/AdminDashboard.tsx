import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Package, Calendar, Users, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import { adminApi } from '../../lib/api';
import { getStatusColor, getStatusLabel } from '../../lib/utils';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const STATUS_COLORS = ['#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#6b7280', '#ef4444'];

const AdminDashboard = () => {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => adminApi.getDashboard().then((r) => r.data.data),
    refetchInterval: 60000,
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>;

  const { overview, reservations, reservationsByStatus, lowStockProducts, popularProducts, recentReservations } = data || {};

  const statsCards = [
    { label: t('admin.dashboard.total_products'), value: overview?.totalProducts, icon: Package, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: t('admin.dashboard.total_reservations'), value: overview?.totalReservations, icon: Calendar, color: 'text-green-600', bg: 'bg-green-100' },
    { label: t('admin.dashboard.customers'), value: overview?.totalCustomers, icon: Users, color: 'text-purple-600', bg: 'bg-purple-100' },
    { label: t('admin.dashboard.pending'), value: overview?.pendingReservations, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-100' },
  ];

  const periodData = [
    { name: t('admin.dashboard.today'), value: reservations?.daily },
    { name: t('admin.dashboard.this_week'), value: reservations?.weekly },
    { name: t('admin.dashboard.this_month'), value: reservations?.monthly },
  ];

  const statusPieData = reservationsByStatus?.map((s: { status: string; _count: { status: number } }, i: number) => ({
    name: getStatusLabel(s.status),
    value: s._count.status,
    color: STATUS_COLORS[i] || '#ccc',
  })) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('admin.dashboard.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('admin.dashboard.welcome')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">{label}</p>
              <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center`}>
                <Icon size={18} className={color} />
              </div>
            </div>
            <p className="text-2xl font-bold">{value ?? '—'}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reservation trend */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-primary" /> {t('admin.dashboard.reservation_trend')}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={periodData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name={t('admin.dashboard.reservations_label')} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status distribution */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">{t('admin.dashboard.reservations_by_status')}</h3>
          {statusPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusPieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                  {statusPieData.map((_: unknown, i: number) => <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-center text-muted-foreground py-10">{t('admin.dashboard.no_data')}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low stock */}
        {lowStockProducts && lowStockProducts.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2 text-orange-600"><AlertTriangle size={16} /> {t('admin.dashboard.low_stock_alert')} ({lowStockProducts.length})</h3>
            <div className="space-y-2">
              {lowStockProducts.map((item: { id: string; product: { name: string }; stockCount: number }) => (
                <div key={item.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                  <span className="text-sm">{item.product.name}</span>
                  <span className="text-xs font-medium px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">{item.stockCount} {t('admin.dashboard.left')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent reservations */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">{t('admin.dashboard.recent_reservations')}</h3>
          <div className="space-y-2">
            {recentReservations?.slice(0, 5).map((r: { id: string; reservationNumber: string; customerName: string; status: string; visitDate: string }) => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium font-mono">{r.reservationNumber}</p>
                  <p className="text-xs text-muted-foreground">{r.customerName}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor(r.status)}`}>{getStatusLabel(r.status)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
