import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Upload as ImageUp, Loader2, MapPin, Phone, Save, Share2, Store, Truck, X } from 'lucide-react';
import { adminApi, cmsApi, mediaApi } from '../../lib/api';
import { buildBusiness, useSiteConfig } from '../../lib/siteConfig';
import { RWANDA_PROVINCES as PROVINCE_LIST, getDeliveryFee } from '../../lib/rwanda';

const RWANDA_PROVINCES = PROVINCE_LIST.map((p) => p.name);
import { toast } from '../../components/ui/Toaster';
import { cn } from '../../lib/utils';

type Values = Record<string, string | boolean>;
interface Zone { id?: string; province: string; district: string; baseFee: number; estimatedDays: number; isActive: boolean }

const TEXT_KEYS = [
  'site.name', 'site.legalName', 'site.logo',
  'contact.phone', 'contact.whatsapp', 'contact.email', 'contact.address', 'contact.hours', 'contact.lat', 'contact.lng',
  'social.facebook', 'social.instagram', 'social.twitter', 'social.tiktok',
  'payment.momoNumber', 'payment.airtelNumber', 'payment.bankDetails', 'delivery.sameDaySurcharge',
];
const BOOL_KEYS = ['payment.airtelEnabled', 'payment.bankEnabled', 'payment.payInPersonEnabled'];

const fieldClass = 'w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20';

const Section = ({ icon: Icon, title, hint, children }: { icon: typeof Store; title: string; hint?: string; children: React.ReactNode }) => (
  <section className="surface p-5 sm:p-6">
    <div className="mb-5 flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon size={18} /></span>
      <div>
        <h2 className="font-semibold">{title}</h2>
        {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
      </div>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">{children}</div>
  </section>
);

/**
 * Admin → Settings: the business details the whole site uses. Saved as site
 * settings (and, for delivery prices, as delivery zones) — the same values the
 * server prices orders with. Any field left empty falls back to the site's
 * built-in value, shown as the placeholder.
 */
const AdminSettings = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const defaults = useMemo(() => buildBusiness({}), []);
  const [values, setValues] = useState<Values>({});
  const [fees, setFees] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => cmsApi.getAllSettings().then((r) => (r.data.data ?? {}) as Record<string, unknown>),
  });
  const { data: zones } = useQuery({
    queryKey: ['admin-delivery-zones'],
    queryFn: () => adminApi.getDeliveryZones().then((r) => r.data.data as Zone[]),
  });

  useEffect(() => {
    if (!settings) return;
    const next: Values = {};
    for (const k of TEXT_KEYS) next[k] = settings[k] == null ? '' : String(settings[k]);
    for (const k of BOOL_KEYS) next[k] = typeof settings[k] === 'boolean' ? (settings[k] as boolean) : k === 'payment.airtelEnabled' ? false : true;
    setValues(next);
  }, [settings]);

  useEffect(() => {
    if (!zones) return;
    const next: Record<string, string> = {};
    for (const p of RWANDA_PROVINCES) {
      const z = zones.find((x) => x.province === p && !x.district);
      next[p] = String(z ? z.baseFee : getDeliveryFee(p));
    }
    setFees(next);
  }, [zones]);

  const set = (k: string, v: string | boolean) => { setValues((s) => ({ ...s, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })); };
  const text = (k: string) => String(values[k] ?? '');
  const bool = (k: string) => values[k] === true;

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {};
      for (const k of TEXT_KEYS) {
        const v = text(k).trim();
        payload[k] = (k === 'contact.lat' || k === 'contact.lng' || k === 'delivery.sameDaySurcharge') && v !== '' ? Number(v) : v;
      }
      for (const k of BOOL_KEYS) payload[k] = bool(k);
      await cmsApi.updateSettings(payload);
      // Province-wide delivery fees: one zone row per province.
      for (const p of RWANDA_PROVINCES) {
        const fee = Number(fees[p]);
        if (!Number.isFinite(fee) || fee < 0) throw Object.assign(new Error('fee'), { field: `fee.${p}` });
        const current = zones?.find((x) => x.province === p && !x.district);
        if (!current || current.baseFee !== fee) {
          await adminApi.upsertDeliveryZone({ province: p, district: '', baseFee: fee, estimatedDays: current?.estimatedDays ?? 1, isActive: true });
        }
      }
      return payload;
    },
    onSuccess: (payload) => {
      useSiteConfig.getState().apply(payload);
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-delivery-zones'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-zones'] });
      toast({ title: t('admin.settings_saved', { defaultValue: 'Settings saved' }), description: t('admin.settings_saved_desc', { defaultValue: 'The website shows the new details within a minute.' }), variant: 'success' });
    },
    onError: (err: unknown) => {
      const e = err as { field?: string; response?: { data?: { field?: string; message?: string } } };
      const field = e.field || e.response?.data?.field;
      const message = e.field ? t('admin.settings_fee_invalid', { defaultValue: 'Enter a delivery price of 0 or more' }) : e.response?.data?.message || t('admin.settings_save_failed', { defaultValue: 'The settings could not be saved' });
      if (field) {
        setErrors((x) => ({ ...x, [field]: message }));
        document.querySelector(`[data-field="${field}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      toast({ title: t('admin.settings_save_failed', { defaultValue: 'The settings could not be saved' }), description: message, variant: 'error' });
    },
  });

  const uploadLogo = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('files', file);
      const res = await mediaApi.upload(fd);
      const url = (res.data.data as { url: string }[])[0]?.url;
      if (url) set('site.logo', url);
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast({ title: t('admin.settings_logo_failed', { defaultValue: 'The logo could not be uploaded' }), description: message, variant: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const field = (k: string, label: string, opts: { placeholder?: string; hint?: string; type?: string; wide?: boolean; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'] } = {}) => (
    <label className={cn('block', opts.wide && 'sm:col-span-2')} data-field={k}>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input type={opts.type || 'text'} inputMode={opts.inputMode} value={text(k)} onChange={(e) => set(k, e.target.value)}
        placeholder={opts.placeholder} className={cn(fieldClass, errors[k] && 'border-destructive')} aria-invalid={!!errors[k]} />
      {errors[k] ? <span className="mt-1 block text-xs text-destructive">{errors[k]}</span> : opts.hint && <span className="mt-1 block text-xs text-muted-foreground">{opts.hint}</span>}
    </label>
  );

  const toggle = (k: string, label: string, hint: string) => (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-border p-3.5 sm:col-span-2">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <input type="checkbox" checked={bool(k)} onChange={(e) => set(k, e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[hsl(var(--primary))]" />
    </label>
  );

  if (isLoading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-muted-foreground" /></div>;

  return (
    <div className="mx-auto max-w-4xl pb-24">
      <div className="mb-6">
        <p className="eyebrow">{t('admin.settings_eyebrow', { defaultValue: 'Your business' })}</p>
        <h1 className="section-title">{t('admin.nav_settings', { defaultValue: 'Settings' })}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('admin.settings_intro', { defaultValue: 'These details appear across the website, on invoices and at checkout. Leave a field empty to use the value shown in grey. Page texts and photos are edited with "Edit website" on the site itself.' })}
        </p>
      </div>

      <div className="space-y-5">
        <Section icon={Store} title={t('admin.settings_shop', { defaultValue: 'Shop' })}>
          {field('site.name', t('admin.settings_shop_name', { defaultValue: 'Shop name' }), { placeholder: defaults.name })}
          {field('site.legalName', t('admin.settings_legal_name', { defaultValue: 'Company name (invoices, footer)' }), { placeholder: defaults.legalName })}
          <div className="sm:col-span-2" data-field="site.logo">
            <span className="mb-1.5 block text-sm font-medium">{t('admin.settings_logo', { defaultValue: 'Logo' })}</span>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-16 min-w-[8rem] items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 px-3">
                {text('site.logo')
                  ? <img src={text('site.logo')} alt="" className="max-h-12 max-w-[10rem] object-contain" />
                  : <span className="text-xs text-muted-foreground">{t('admin.settings_logo_none', { defaultValue: 'Wordmark (no logo)' })}</span>}
              </div>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ''; }} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn btn-outline btn-sm">
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImageUp size={14} />} {t('admin.settings_logo_upload', { defaultValue: 'Upload logo' })}
              </button>
              {text('site.logo') && (
                <button type="button" onClick={() => set('site.logo', '')} className="btn btn-outline btn-sm text-destructive">
                  <X size={14} /> {t('admin.settings_logo_remove', { defaultValue: 'Remove' })}
                </button>
              )}
            </div>
            <span className="mt-1 block text-xs text-muted-foreground">{t('admin.settings_logo_hint', { defaultValue: 'PNG or SVG with a transparent background looks best. Shown in the header and footer.' })}</span>
          </div>
        </Section>

        <Section icon={Phone} title={t('admin.settings_contact', { defaultValue: 'Contact' })} hint={t('admin.settings_contact_hint', { defaultValue: 'Shown in the header, footer, Contact page and on invoices.' })}>
          {field('contact.phone', t('admin.settings_phone', { defaultValue: 'Phone' }), { placeholder: defaults.phone, inputMode: 'tel' })}
          {field('contact.whatsapp', t('admin.settings_whatsapp', { defaultValue: 'WhatsApp number' }), { placeholder: defaults.whatsapp, inputMode: 'tel', hint: t('admin.settings_whatsapp_hint', { defaultValue: 'Every "WhatsApp us" button opens a chat with this number.' }) })}
          {field('contact.email', t('admin.settings_email', { defaultValue: 'Email' }), { placeholder: defaults.email, type: 'email' })}
          {field('contact.hours', t('admin.settings_hours', { defaultValue: 'Opening hours' }), { placeholder: defaults.hours })}
          {field('contact.address', t('admin.settings_address', { defaultValue: 'Shop address' }), { placeholder: defaults.address, wide: true })}
        </Section>

        <Section icon={MapPin} title={t('admin.settings_map', { defaultValue: 'Map position' })} hint={t('admin.settings_map_hint', { defaultValue: 'In Google Maps, press and hold on your shop: the two numbers that appear are latitude and longitude.' })}>
          {field('contact.lat', t('admin.settings_lat', { defaultValue: 'Latitude' }), { placeholder: String(defaults.lat), inputMode: 'decimal' })}
          {field('contact.lng', t('admin.settings_lng', { defaultValue: 'Longitude' }), { placeholder: String(defaults.lng), inputMode: 'decimal' })}
        </Section>

        <Section icon={Share2} title={t('admin.settings_social', { defaultValue: 'Social media' })} hint={t('admin.settings_social_hint', { defaultValue: 'Full links. Leave empty to hide that icon.' })}>
          {field('social.facebook', 'Facebook', { placeholder: defaults.social.facebook || 'https://facebook.com/…' })}
          {field('social.instagram', 'Instagram', { placeholder: defaults.social.instagram || 'https://instagram.com/…' })}
          {field('social.tiktok', 'TikTok', { placeholder: 'https://tiktok.com/@…' })}
          {field('social.twitter', 'X / Twitter', { placeholder: 'https://x.com/…' })}
        </Section>

        <Section icon={CreditCard} title={t('admin.settings_payments', { defaultValue: 'Payments' })} hint={t('admin.settings_payments_hint', { defaultValue: 'Automatic MoMo payments go to your Paypack account. The numbers below are used when a customer pays by dialling (USSD).' })}>
          {field('payment.momoNumber', t('admin.settings_momo', { defaultValue: 'MTN MoMo number' }), { placeholder: defaults.momoNumber, inputMode: 'tel' })}
          {field('payment.airtelNumber', t('admin.settings_airtel', { defaultValue: 'Airtel Money number' }), { placeholder: '0730 000 000', inputMode: 'tel' })}
          {toggle('payment.airtelEnabled', t('admin.settings_airtel_on', { defaultValue: 'Offer Airtel Money at checkout' }), t('admin.settings_airtel_on_hint', { defaultValue: 'Only shown to customers when an Airtel number is set.' }))}
          {toggle('payment.bankEnabled', t('admin.settings_bank_on', { defaultValue: 'Offer bank transfer' }), t('admin.settings_bank_on_hint', { defaultValue: 'Customers are told you will send the account details.' }))}
          <label className="block sm:col-span-2" data-field="payment.bankDetails">
            <span className="mb-1.5 block text-sm font-medium">{t('admin.settings_bank_details', { defaultValue: 'Bank account details (for your team)' })}</span>
            <textarea rows={3} value={text('payment.bankDetails')} onChange={(e) => set('payment.bankDetails', e.target.value)} maxLength={500}
              placeholder={t('admin.settings_bank_placeholder', { defaultValue: 'Bank, account name, account number' })} className={cn(fieldClass, 'resize-none')} />
          </label>
          {toggle('payment.payInPersonEnabled', t('admin.settings_inperson_on', { defaultValue: 'Offer pay in person' }), t('admin.settings_inperson_on_hint', { defaultValue: 'Pay at the shop when collecting, or to the courier on delivery.' }))}
        </Section>

        <Section icon={Truck} title={t('admin.settings_delivery', { defaultValue: 'Delivery prices' })} hint={t('admin.settings_delivery_hint', { defaultValue: 'What customers pay for delivery to each province, in RWF. Checkout and orders use exactly these prices.' })}>
          {RWANDA_PROVINCES.map((p) => (
            <label key={p} className="block" data-field={`fee.${p}`}>
              <span className="mb-1.5 block text-sm font-medium">{p}</span>
              <div className="relative">
                <input type="number" min={0} step={100} inputMode="numeric" value={fees[p] ?? ''} onChange={(e) => { setFees((f) => ({ ...f, [p]: e.target.value })); setErrors((x) => ({ ...x, [`fee.${p}`]: '' })); }}
                  className={cn(fieldClass, 'pr-14', errors[`fee.${p}`] && 'border-destructive')} />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">RWF</span>
              </div>
              {errors[`fee.${p}`] && <span className="mt-1 block text-xs text-destructive">{errors[`fee.${p}`]}</span>}
            </label>
          ))}
          {field('delivery.sameDaySurcharge', t('admin.settings_sameday', { defaultValue: 'Same-day delivery extra (RWF)' }), { placeholder: String(defaults.sameDaySurcharge), inputMode: 'numeric' })}
        </Section>
      </div>

      {/* Always reachable save bar */}
      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-card/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-64">
        <div className="mx-auto flex max-w-4xl items-center justify-end gap-3">
          <button type="button" onClick={() => save.mutate()} disabled={save.isPending} className="btn btn-primary">
            {save.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {t('admin.settings_save', { defaultValue: 'Save settings' })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
