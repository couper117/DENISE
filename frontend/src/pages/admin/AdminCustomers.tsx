import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Search, Users, Calendar } from 'lucide-react';
import { adminApi } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const AdminCustomers = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-customers', { search, page }],
    queryFn: () => adminApi.getCustomers({ search: search || undefined, page, limit: 20 }).then((r) => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => adminApi.toggleCustomerStatus(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-customers'] }),
  });

  const customers = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('admin.customers.title')}</h1>
        <span className="text-sm text-muted-foreground">{pagination?.total || 0} {t('admin.total')}</span>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('admin.customers.search')}
          className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {[t('admin.customers.col_customer'), t('admin.customers.col_phone'), t('admin.customers.col_email'), t('admin.customers.col_reservations'), t('admin.customers.col_joined'), t('admin.status'), t('admin.actions')].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customers.map((customer: { id: string; firstName: string; lastName: string; phone: string; email?: string; isActive: boolean; createdAt: string; _count: { reservations: number } }) => (
                <tr key={customer.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary text-xs font-bold">
                        {customer.firstName[0]}{customer.lastName[0]}
                      </div>
                      <span className="font-medium">{customer.firstName} {customer.lastName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{customer.phone}</td>
                  <td className="px-4 py-3 text-muted-foreground">{customer.email || '—'}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">{customer._count.reservations}</span></td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(customer.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${customer.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {customer.isActive ? t('admin.customers.active') : t('admin.customers.disabled')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleMutation.mutate(customer.id)} disabled={toggleMutation.isPending}
                      className="text-xs px-2 py-1 border border-border rounded-lg hover:bg-accent transition-colors">
                      {customer.isActive ? t('admin.customers.disable') : t('admin.customers.enable')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {customers.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Users size={32} className="mx-auto mb-2 opacity-30" />
              <p>{t('admin.customers.no_customers')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminCustomers;
