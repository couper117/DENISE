import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Search, ChevronDown, Truck, Store, Package } from 'lucide-react';
import { reservationsApi } from '../../lib/api';
import { Reservation } from '../../types';
import { formatDate, getStatusColor, getStatusLabel } from '../../lib/utils';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const ALL_STATUSES = [
  '', 'PENDING', 'CONFIRMED', 'PREPARING', 'PROCESSING',
  'PACKED', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED',
  'COMPLETED', 'CANCELLED',
];

const FULFILLMENT_ICONS: Record<string, React.ReactNode> = {
  RESERVATION: <Store size={12} className="text-green-600" />,
  PICKUP: <Package size={12} className="text-blue-600" />,
  DELIVERY: <Truck size={12} className="text-purple-600" />,
};

const FULFILLMENT_LABEL_KEYS: Record<string, string> = {
  RESERVATION: 'admin.reservations.label_reserve',
  PICKUP: 'admin.reservations.label_pickup',
  DELIVERY: 'admin.reservations.label_delivery',
};

const AdminReservations = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [fulfillmentFilter, setFulfillmentFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [newStatus, setNewStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-reservations', { search, status, fulfillmentFilter, page }],
    queryFn: () =>
      reservationsApi.getAll({
        search: search || undefined,
        status: status || undefined,
        fulfillmentType: fulfillmentFilter || undefined,
        page,
        limit: 20,
      }).then((r) => r.data),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, adminNotes }: { id: string; status: string; adminNotes?: string }) =>
      reservationsApi.updateStatus(id, { status, adminNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reservations'] });
      setSelected(null);
    },
  });

  const reservations: Reservation[] = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('admin.reservations.title')}</h1>
        <span className="text-sm text-muted-foreground">{pagination?.total || 0} {t('admin.total')}</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('admin.reservations.search')}
            className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div className="relative">
          <select value={fulfillmentFilter} onChange={(e) => { setFulfillmentFilter(e.target.value); setPage(1); }}
            className="appearance-none px-4 py-2.5 pr-8 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
            <option value="">{t('admin.reservations.all_types')}</option>
            <option value="RESERVATION">{t('admin.reservations.type_reservations')}</option>
            <option value="PICKUP">{t('admin.reservations.type_pickup')}</option>
            <option value="DELIVERY">{t('admin.reservations.type_delivery')}</option>
          </select>
          <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
        <div className="relative">
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="appearance-none px-4 py-2.5 pr-8 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{s ? getStatusLabel(s) : t('admin.reservations.all_statuses')}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  {[t('admin.reservations.col_reference'), t('admin.reservations.col_customer'), t('admin.reservations.col_type'), t('admin.reservations.col_date_address'), t('admin.reservations.col_items'), t('admin.status'), t('admin.actions')].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reservations.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono font-medium text-primary text-xs">{r.reservationNumber}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center text-xs font-bold text-primary shrink-0">
                          {r.customerName[0]}
                        </div>
                        <div>
                          <p className="font-medium">{r.customerName}</p>
                          <p className="text-xs text-muted-foreground">{r.customerPhone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {FULFILLMENT_ICONS[r.fulfillmentType]}
                        <span className="text-xs">{FULFILLMENT_LABEL_KEYS[r.fulfillmentType] ? t(FULFILLMENT_LABEL_KEYS[r.fulfillmentType]) : r.fulfillmentType}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {r.fulfillmentType === 'DELIVERY' && r.deliveryAddress
                        ? `${r.deliveryAddress.district}, ${r.deliveryAddress.province}`
                        : r.visitDate
                        ? `${formatDate(r.visitDate)}${r.visitTime ? ` • ${r.visitTime}` : ''}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-muted rounded-full text-xs">{r.items?.length || 0} {t('admin.reservations.items_count')}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full border font-medium ${getStatusColor(r.status)}`}>
                        {getStatusLabel(r.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { setSelected(r); setNewStatus(r.status); setAdminNotes(r.adminNotes || ''); }}
                        className="px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                      >
                        {t('admin.reservations.manage')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {reservations.length === 0 && (
            <p className="text-center text-muted-foreground py-10">{t('admin.reservations.no_orders')}</p>
          )}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
            className="px-4 py-2 border border-border rounded-lg text-sm disabled:opacity-50 hover:bg-accent transition-colors">{t('admin.prev')}</button>
          <span className="px-4 py-2 text-sm">{page} / {pagination.totalPages}</span>
          <button disabled={page === pagination.totalPages} onClick={() => setPage((p) => p + 1)}
            className="px-4 py-2 border border-border rounded-lg text-sm disabled:opacity-50 hover:bg-accent transition-colors">{t('admin.next')}</button>
        </div>
      )}

      {/* Manage Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-lg mb-4">{t('admin.reservations.manage_order')}</h3>
            <div className="space-y-2 mb-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{t('admin.reservations.col_reference')}:</span><span className="font-mono font-bold text-primary">{selected.reservationNumber}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t('admin.reservations.col_type')}:</span><span className="flex items-center gap-1">{FULFILLMENT_ICONS[selected.fulfillmentType]} {FULFILLMENT_LABEL_KEYS[selected.fulfillmentType] ? t(FULFILLMENT_LABEL_KEYS[selected.fulfillmentType]) : selected.fulfillmentType}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t('admin.reservations.col_customer')}:</span><span>{selected.customerName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t('admin.customers.col_phone')}:</span><span>{selected.customerPhone}</span></div>
              {selected.fulfillmentType === 'DELIVERY' && selected.deliveryAddress ? (
                <div className="flex justify-between"><span className="text-muted-foreground">{t('admin.reservations.deliver_to')}:</span><span>{selected.deliveryAddress.district}, {selected.deliveryAddress.province}</span></div>
              ) : selected.visitDate ? (
                <div className="flex justify-between"><span className="text-muted-foreground">{t('admin.reservations.visit')}:</span><span>{formatDate(selected.visitDate)}{selected.visitTime ? ` ${t('admin.reservations.at')} ${selected.visitTime}` : ''}</span></div>
              ) : null}
              {selected.totalAmount && (
                <div className="flex justify-between"><span className="text-muted-foreground">{t('admin.reservations.total_amount')}:</span><span className="font-bold text-primary">{selected.totalAmount.toLocaleString()} RWF</span></div>
              )}
            </div>

            <div className="mb-4">
              <label className="text-sm font-medium block mb-1.5">{t('admin.reservations.update_status')}</label>
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                {ALL_STATUSES.filter(Boolean).map((s) => (
                  <option key={s} value={s}>{getStatusLabel(s)}</option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <label className="text-sm font-medium block mb-1.5">{t('admin.reservations.message_to_customer')}</label>
              <textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={3}
                placeholder={t('admin.reservations.message_placeholder')}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setSelected(null)}
                className="flex-1 py-2.5 border border-border rounded-xl text-sm hover:bg-accent transition-colors">
                {t('admin.cancel')}
              </button>
              <button
                onClick={() => updateStatusMutation.mutate({ id: selected.id, status: newStatus, adminNotes })}
                disabled={updateStatusMutation.isPending}
                className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-70">
                {updateStatusMutation.isPending ? t('admin.reservations.updating') : t('admin.reservations.update_status')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReservations;
