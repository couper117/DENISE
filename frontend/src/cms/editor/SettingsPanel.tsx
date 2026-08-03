import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Save, Search, X } from 'lucide-react';
import { cmsApi } from '../../lib/api';
import { toast } from '../../components/ui/Toaster';
import { useCmsStore } from '../store';
import { errorMessage, refreshDraft } from '../sync';

/**
 * Site-wide settings and global find-and-replace.
 *
 * Settings are *not* localised and have no draft state — a logo or a theme
 * colour is one value for the whole site, so they save immediately rather than
 * going through the publish flow that content blocks use.
 */

type Settings = Record<string, unknown>;

const TEXT_FIELDS: { key: string; label: string; hint?: string; placeholder?: string }[] = [
  { key: 'site.name', label: 'Site name' },
  { key: 'site.logo', label: 'Logo URL', hint: 'Shown in the header. Leave empty to use the DENISE wordmark.' },
  { key: 'site.favicon', label: 'Favicon URL', placeholder: '/favicon.svg' },
  { key: 'seo.metaTitle', label: 'Default meta title' },
  { key: 'seo.metaDescription', label: 'Default meta description' },
  { key: 'seo.ogImage', label: 'Default OpenGraph image URL' },
  { key: 'analytics.gaId', label: 'Google Analytics ID', placeholder: 'G-XXXXXXXXXX' },
];

const COLOR_FIELDS = [
  { key: 'theme.primary', label: 'Primary', fallback: '#8B1A1A' },
  { key: 'theme.secondary', label: 'Secondary', fallback: '#C8972A' },
  { key: 'theme.accent', label: 'Accent', fallback: '#006B3C' },
];

const SettingsPanel = ({ onClose }: { onClose: () => void }) => {
  const locale = useCmsStore((s) => s.locale);
  const [tab, setTab] = useState<'site' | 'replace'>('site');
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [allLocales, setAllLocales] = useState(false);
  const [preview, setPreview] = useState<{ matched: number; changes: { key: string; locale: string; before: string; after: string }[] } | null>(null);
  const [replacing, setReplacing] = useState(false);

  useEffect(() => {
    cmsApi
      .getAllSettings()
      .then((r) => setSettings(r.data.data ?? {}))
      .catch((e) => toast({ title: 'Could not load settings', description: errorMessage(e, ''), variant: 'error' }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const set = (key: string, value: unknown) => setSettings((s) => ({ ...s, [key]: value }));
  const str = (key: string, fallback = '') => String(settings[key] ?? fallback);

  const save = async () => {
    setSaving(true);
    try {
      await cmsApi.updateSettings(settings);
      toast({ title: 'Settings saved', variant: 'success' });
    } catch (e) {
      toast({ title: 'Could not save settings', description: errorMessage(e, ''), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const runPreview = async () => {
    if (!find.trim()) return;
    setReplacing(true);
    try {
      const r = await cmsApi.replace(find, replace, { locale: allLocales ? undefined : locale, dryRun: true });
      setPreview(r.data.data);
    } catch (e) {
      toast({ title: 'Search failed', description: errorMessage(e, ''), variant: 'error' });
    } finally {
      setReplacing(false);
    }
  };

  const applyReplace = async () => {
    setReplacing(true);
    try {
      const r = await cmsApi.replace(find, replace, { locale: allLocales ? undefined : locale, dryRun: false });
      const n = r.data.data?.matched ?? 0;
      await refreshDraft();
      setPreview(null);
      toast({
        title: `Replaced in ${n} block${n === 1 ? '' : 's'}`,
        description: 'These are drafts until you publish.',
        variant: 'success',
      });
    } catch (e) {
      toast({ title: 'Replace failed', description: errorMessage(e, ''), variant: 'error' });
    } finally {
      setReplacing(false);
    }
  };

  return createPortal(
    <div data-cms-chrome="" className="cms-modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cms-modal cms-modal-mid cms-glass" role="dialog" aria-label="Site settings">
        <div className="cms-panel-head">
          <div className="flex items-center gap-1">
            <button type="button" className={`cms-chip ${tab === 'site' ? 'is-active' : ''}`} onClick={() => setTab('site')}>
              Site settings
            </button>
            <button type="button" className={`cms-chip ${tab === 'replace' ? 'is-active' : ''}`} onClick={() => setTab('replace')}>
              Find &amp; replace
            </button>
          </div>
          <button type="button" className="cms-icon-btn" onClick={onClose} aria-label="Close"><X size={15} /></button>
        </div>

        <div className="cms-panel-body">
          {loading ? (
            <Loader2 size={16} className="animate-spin opacity-50" />
          ) : tab === 'site' ? (
            <div className="flex flex-col gap-3.5">
              {TEXT_FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="cms-label">{f.label}</label>
                  <input className="cms-input" value={str(f.key)} placeholder={f.placeholder}
                    onChange={(e) => set(f.key, e.target.value)} />
                  {f.hint && <p className="cms-hint">{f.hint}</p>}
                </div>
              ))}

              <div>
                <label className="cms-label">Theme colours</label>
                <div className="flex flex-col gap-2">
                  {COLOR_FIELDS.map((c) => (
                    <div key={c.key} className="flex items-center gap-2">
                      <input type="color" className="cms-color-swatch" value={str(c.key, c.fallback)}
                        onChange={(e) => set(c.key, e.target.value)} aria-label={c.label} />
                      <span className="text-[12px] w-20 shrink-0">{c.label}</span>
                      <input className="cms-input font-mono" value={str(c.key, c.fallback)}
                        onChange={(e) => set(c.key, e.target.value)} />
                    </div>
                  ))}
                </div>
                <p className="cms-hint">Applied as CSS variables site-wide on the next page load.</p>
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input type="checkbox" className="mt-0.5" checked={Boolean(settings['site.maintenance'])}
                  onChange={(e) => set('site.maintenance', e.target.checked)} />
                <span>
                  <span className="block text-[12.5px] font-semibold">Maintenance mode</span>
                  <span className="cms-hint">
                    Visitors see a holding page. Signed-in admins keep full access, so you can
                    check the site before turning it back on.
                  </span>
                </span>
              </label>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <label className="cms-label">Find</label>
                <input className="cms-input" value={find} onChange={(e) => { setFind(e.target.value); setPreview(null); }} />
              </div>
              <div>
                <label className="cms-label">Replace with</label>
                <input className="cms-input" value={replace} onChange={(e) => { setReplace(e.target.value); setPreview(null); }} />
              </div>
              <label className="flex items-center gap-2 text-[12px] cursor-pointer select-none">
                <input type="checkbox" checked={allLocales} onChange={(e) => { setAllLocales(e.target.checked); setPreview(null); }} />
                Search every language (not just {locale.toUpperCase()})
              </label>

              <button type="button" className="cms-btn" onClick={runPreview} disabled={!find.trim() || replacing}>
                {replacing ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />} Preview matches
              </button>

              {preview && (
                <div className="flex flex-col gap-2">
                  <p className="cms-hint">
                    {preview.matched} block{preview.matched === 1 ? '' : 's'} would change. Only plain and rich
                    text is searched — URLs and icon names are left alone.
                  </p>
                  {preview.changes.slice(0, 12).map((c) => (
                    <div key={c.key + c.locale} className="cms-row">
                      <div className="cms-row-body !py-2 !gap-1">
                        <p className="cms-panel-key">{c.key} · {c.locale}</p>
                        <p className="text-[12px]"><span className="cms-del">{c.before}</span></p>
                        <p className="text-[12px]"><span className="cms-add">{c.after}</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="cms-panel-foot">
          <button type="button" className="cms-btn" onClick={onClose}>Close</button>
          {tab === 'site' ? (
            <button type="button" className="cms-btn cms-btn-primary" onClick={save} disabled={saving}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save settings
            </button>
          ) : (
            <button type="button" className="cms-btn cms-btn-primary" onClick={applyReplace}
              disabled={!preview || preview.matched === 0 || replacing}>
              {replacing ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Replace {preview ? preview.matched : 0}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SettingsPanel;
