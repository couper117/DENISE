import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Warehouse, AlertTriangle } from 'lucide-react';
import { adminApi } from '../../lib/api';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const AdminInventory = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editId, setEditId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ stockCount: '', metersAvailable: '', lowStockAlert: '5' });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-inventory'],
    queryFn: () => adminApi.getInventory().then((r) => r.data.data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ productId, data }: { productId: string; data: Record<string, unknown> }) => adminApi.updateInventory(productId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-inventory'] }); setEditId(null); },
  });

  const inventory = data || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('admin.inventory.title')}</h1>

      {isLoading ? <LoadingSpinner /> : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {[t('admin.inventory.col_product'), t('admin.inventory.col_category'), t('admin.inventory.col_stock'), t('admin.inventory.col_meters'), t('admin.inventory.col_alert'), t('admin.actions')].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {inventory.map((item: { id: string; productId: string; product: { name: string; category: { name: string } }; stockCount: number; metersAvailable?: number; lowStockAlert: number }) => (
                <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{item.product.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.product.category?.name}</td>
                  <td className="px-4 py-3">
                    {editId === item.productId ? (
                      <input type="number" value={editValues.stockCount} onChange={(e) => setEditValues(p => ({ ...p, stockCount: e.target.value }))} min="0"
                        className="w-20 px-2 py-1 bg-background border border-border rounded text-sm" />
                    ) : (
                      <span className={`font-medium ${item.stockCount <= item.lowStockAlert ? 'text-orange-600' : 'text-foreground'}`}>
                        {item.stockCount}
                        {item.stockCount <= item.lowStockAlert && <AlertTriangle size={12} className="inline ml-1 text-orange-500" />}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {editId === item.productId ? (
                      <input type="number" step="0.1" value={editValues.metersAvailable} onChange={(e) => setEditValues(p => ({ ...p, metersAvailable: e.target.value }))}
                        className="w-24 px-2 py-1 bg-background border border-border rounded text-sm" />
                    ) : (item.metersAvailable != null ? `${item.metersAvailable}m` : '—')}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {editId === item.productId ? (
                      <input type="number" value={editValues.lowStockAlert} onChange={(e) => setEditValues(p => ({ ...p, lowStockAlert: e.target.value }))} min="0"
                        className="w-16 px-2 py-1 bg-background border border-border rounded text-sm" />
                    ) : item.lowStockAlert}
                  </td>
                  <td className="px-4 py-3">
                    {editId === item.productId ? (
                      <div className="flex gap-1">
                        <button onClick={() => updateMutation.mutate({ productId: item.productId, data: editValues })}
                          disabled={updateMutation.isPending}
                          className="px-2 py-1 bg-primary text-white text-xs rounded hover:bg-primary/90 transition-colors">{t('admin.save')}</button>
                        <button onClick={() => setEditId(null)} className="px-2 py-1 border border-border text-xs rounded hover:bg-accent transition-colors">{t('admin.cancel')}</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditId(item.productId); setEditValues({ stockCount: String(item.stockCount), metersAvailable: String(item.metersAvailable || ''), lowStockAlert: String(item.lowStockAlert) }); }}
                        className="px-3 py-1 border border-border text-xs rounded-lg hover:bg-accent transition-colors">{t('admin.edit')}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {inventory.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Warehouse size={32} className="mx-auto mb-2 opacity-30" />
              <p>{t('admin.inventory.no_records')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminInventory;
