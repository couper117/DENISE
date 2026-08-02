import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FileText, Save } from 'lucide-react';
import { adminApi } from '../../lib/api';

const CONTENT_KEYS = [
  { key: 'hero.title', labelKey: 'admin.content.hero_title', type: 'text' },
  { key: 'hero.subtitle', labelKey: 'admin.content.hero_subtitle', type: 'textarea' },
  { key: 'about.text', labelKey: 'admin.content.about_text', type: 'textarea' },
  { key: 'whatsapp.number', labelKey: 'admin.content.whatsapp_number', type: 'text' },
  { key: 'shop.address', labelKey: 'admin.content.shop_address', type: 'text' },
  { key: 'shop.phone', labelKey: 'admin.content.shop_phone', type: 'text' },
  { key: 'shop.email', labelKey: 'admin.content.shop_email', type: 'text' },
  { key: 'shop.hours', labelKey: 'admin.content.business_hours', type: 'text' },
];

const AdminContent = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string[]>([]);

  const { data } = useQuery({
    queryKey: ['site-content'],
    queryFn: () => adminApi.getContent().then((r) => { setValues(r.data.data); return r.data.data as Record<string, string>; }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => adminApi.updateContent({ key, value }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['site-content'] });
      setSaved((prev) => [...prev, vars.key]);
      setTimeout(() => setSaved((prev) => prev.filter((k) => k !== vars.key)), 2000);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FileText size={20} className="text-primary" />
        <h1 className="text-2xl font-bold">{t('admin.content.title')}</h1>
      </div>
      <p className="text-muted-foreground text-sm">{t('admin.content.subtitle')}</p>

      <div className="grid grid-cols-1 gap-4">
        {CONTENT_KEYS.map(({ key, labelKey, type }) => (
          <div key={key} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium block mb-2">{t(labelKey)}</label>
                <p className="text-xs text-muted-foreground mb-2 font-mono">{key}</p>
                {type === 'textarea' ? (
                  <textarea value={values[key] || ''} onChange={(e) => setValues(p => ({ ...p, [key]: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
                ) : (
                  <input type="text" value={values[key] || ''} onChange={(e) => setValues(p => ({ ...p, [key]: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                )}
              </div>
              <button onClick={() => updateMutation.mutate({ key, value: values[key] || '' })}
                disabled={updateMutation.isPending}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors shrink-0 mt-8 ${saved.includes(key) ? 'bg-green-100 text-green-700' : 'bg-primary text-white hover:bg-primary/90'}`}>
                <Save size={12} /> {saved.includes(key) ? t('admin.content.saved') : t('admin.save')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminContent;
