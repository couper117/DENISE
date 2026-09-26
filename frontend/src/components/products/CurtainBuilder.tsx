import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle, Check, ChevronDown, Info, Minus, Moon, Plus, Ruler, ShoppingBag, Sun, Zap,
} from 'lucide-react';
import { Product } from '../../types';
import { productsApi } from '../../lib/api';
import {
  Configuration, CurtainRole, FULLNESS_CHOICES, HEADER_TYPES, LINING_TYPES, MAX_DIMENSION_CM, MAX_QUANTITY,
  OptionChoice, PANEL_LAYOUTS, ROD_OVERHANG_CM, computeRodLengthCm, curtainRole, detectKind, priceConfiguration,
} from '../../lib/productOptions';
import { cn } from '../../lib/utils';

/** One line the builder puts in the cart. */
export interface BuiltLine {
  product: Product;
  config: Configuration;
  quantity: number;
}

interface CurtainBuilderProps {
  product: Product;
  onAdd: (lines: BuiltLine[], buyNow: boolean) => void;
}

const money = (value: number) => `${Math.round(value).toLocaleString()} RWF`;

const fieldClass =
  'w-full rounded-xl border border-input bg-background px-4 py-3 text-base font-medium focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/15 sm:text-sm';

const newSetId = () => `set-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const parseCm = (raw: string): number | undefined => {
  if (raw.trim() === '') return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(Math.round(n), MAX_DIMENSION_CM);
};

/** A double rod (one rail for each curtain) is a single product; anything else
 *  is a single rail, and a window with two curtains needs two of them. */
const isDoubleRod = (rod: Product) => /double|dual|2 ?rail/i.test(rod.name);

const Step = ({ n, title, subtitle, children }: { n: number; title: string; subtitle?: string; children: React.ReactNode }) => (
  <section className="relative pl-10">
    <span className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">{n}</span>
    <h3 className="text-[15px] font-semibold leading-7">{title}</h3>
    {subtitle && <p className="mb-3 text-xs text-muted-foreground">{subtitle}</p>}
    <div className={cn(!subtitle && 'mt-3')}>{children}</div>
  </section>
);

/** Simple window drawing with the two measurements, so "width" and "height"
 *  cannot be confused. */
const WindowDiagram = ({ width, height }: { width?: number; height?: number }) => (
  <svg viewBox="0 0 160 120" className="h-24 w-32 shrink-0 text-muted-foreground" aria-hidden="true">
    <rect x="30" y="16" width="100" height="80" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
    <line x1="80" y1="16" x2="80" y2="96" stroke="currentColor" strokeWidth="1.5" />
    <line x1="30" y1="56" x2="130" y2="56" stroke="currentColor" strokeWidth="1.5" />
    <line x1="30" y1="8" x2="130" y2="8" stroke="hsl(var(--primary))" strokeWidth="2" />
    <text x="80" y="6" textAnchor="middle" fontSize="9" fill="hsl(var(--primary))" fontWeight="700">{width ? `${width} cm` : 'W'}</text>
    <line x1="142" y1="16" x2="142" y2="96" stroke="hsl(var(--primary))" strokeWidth="2" />
    <text x="150" y="60" textAnchor="middle" fontSize="9" fill="hsl(var(--primary))" fontWeight="700" transform="rotate(90 150 60)">{height ? `${height} cm` : 'H'}</text>
  </svg>
);

const ColorPicker = ({ product, value, onChange, error }: { product: Product; value?: string; onChange: (v: string) => void; error?: boolean }) => (
  <div className="flex flex-wrap gap-2">
    {product.colors.map((c) => {
      const selected = value === c.name;
      return (
        <label
          key={c.id}
          className={cn(
            'flex cursor-pointer items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-xs transition-colors focus-within:ring-2 focus-within:ring-primary/30',
            selected ? 'border-foreground bg-foreground/[0.04] font-semibold' : error ? 'border-destructive' : 'border-border hover:border-foreground/30'
          )}
        >
          <input type="radio" className="sr-only" checked={selected} onChange={() => onChange(c.name)} />
          <span className="h-6 w-6 rounded-full border border-black/10" style={{ backgroundColor: c.hexCode || '#ccc' }} />
          {c.name}
          {selected && <Check size={12} />}
        </label>
      );
    })}
  </div>
);

/** Selectable product tile used for the companion curtain and the rod. */
const OptionTile = ({
  selected, onSelect, image, title, detail, price,
}: { selected: boolean; onSelect: () => void; image?: string; title: string; detail?: string; price?: string }) => (
  <button
    type="button"
    onClick={onSelect}
    aria-pressed={selected}
    className={cn(
      'group relative flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-all',
      selected ? 'border-foreground bg-foreground/[0.03] ring-1 ring-foreground' : 'border-border hover:border-foreground/30'
    )}
  >
    <span className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
      {image && <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-medium">{title}</span>
      {detail && <span className="block text-xs text-muted-foreground">{detail}</span>}
      {price && <span className="mt-0.5 block text-sm font-semibold">{price}</span>}
    </span>
    <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border', selected ? 'border-foreground bg-foreground text-background' : 'border-border')}>
      {selected && <Check size={12} />}
    </span>
  </button>
);

const ChoiceRow = ({
  legend, choices, value, onChange, tr,
}: { legend: string; choices: OptionChoice[]; value?: string; onChange: (v: string) => void; tr: (k: string, d: string) => string }) => (
  <fieldset>
    <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{legend}</legend>
    <div className="flex flex-wrap gap-2">
      {choices.map((c) => (
        <label
          key={c.value}
          className={cn(
            'cursor-pointer rounded-full border px-3.5 py-2 text-xs font-medium transition-colors focus-within:ring-2 focus-within:ring-primary/30',
            value === c.value ? 'border-foreground bg-foreground text-background' : 'border-border hover:border-foreground/30'
          )}
        >
          <input type="radio" className="sr-only" checked={value === c.value} onChange={() => onChange(c.value)} />
          {tr(c.labelKey, c.label)}
        </label>
      ))}
    </div>
  </fieldset>
);

/**
 * The curtain buying flow. A window usually takes a night curtain (heavy,
 * "rideau de nuit"), a day curtain (sheer, "rideau du jour") and a rod, so the
 * customer measures the window once and the builder works out the fabric for
 * each curtain and the rod length, offers the companion curtain, and puts the
 * whole set in the cart as linked lines. Prices are estimates from
 * `lib/productOptions.ts`; the server re-prices every line at checkout.
 */
const CurtainBuilder = ({ product, onAdd }: CurtainBuilderProps) => {
  const { t } = useTranslation();
  const tr = (key: string, fallback: string, vars?: Record<string, unknown>) => t(key, { defaultValue: fallback, ...vars });

  const mainRole: CurtainRole = curtainRole(product);
  const companionRole: CurtainRole = mainRole === 'HARD' ? 'SOFT' : 'HARD';

  const [widthCm, setWidthCm] = useState<number | undefined>();
  const [dropCm, setDropCm] = useState<number | undefined>();
  const [color, setColor] = useState<string | undefined>(product.colors?.length === 1 ? product.colors[0].name : undefined);
  const [companionId, setCompanionId] = useState<string | null>(null);
  const [companionColor, setCompanionColor] = useState<string | undefined>();
  const [rodId, setRodId] = useState<string | null>(null);
  const [windows, setWindows] = useState(1);
  const [makeUp, setMakeUp] = useState({ headerType: 'EYELET', lining: 'NONE', panelLayout: 'PAIR', fullness: 2 });
  const [showMakeUp, setShowMakeUp] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  // Every curtain (the parent category includes night and day sub-categories)
  // and every rod; roles are worked out client-side so products still filed
  // under plain "Curtains" are offered too.
  const { data: curtains = [] } = useQuery({
    queryKey: ['products', 'builder-curtains'],
    queryFn: () => productsApi.getAll({ category: 'curtains', limit: 60 }).then((r) => r.data.data as Product[]),
    staleTime: 5 * 60 * 1000,
  });
  const { data: rodCandidates = [] } = useQuery({
    queryKey: ['products', 'builder-rods'],
    queryFn: async () => {
      const [rods, accessories] = await Promise.all([
        productsApi.getAll({ category: 'curtain-rods', limit: 30 }).then((r) => r.data.data as Product[]),
        productsApi.getAll({ category: 'accessories', limit: 30 }).then((r) => r.data.data as Product[]).catch(() => []),
      ]);
      const seen = new Set<string>();
      return [...rods, ...accessories].filter((p) => !seen.has(p.id) && seen.add(p.id));
    },
    staleTime: 5 * 60 * 1000,
  });

  const companions = useMemo(
    () => curtains.filter((p) => p.id !== product.id && p.isAvailable && detectKind(p) === 'CURTAIN' && curtainRole(p) === companionRole),
    [curtains, product.id, companionRole]
  );
  const rods = useMemo(() => rodCandidates.filter((p) => p.isAvailable && detectKind(p) === 'ROD'), [rodCandidates]);

  const companion = companions.find((p) => p.id === companionId) ?? null;
  const rod = rods.find((p) => p.id === rodId) ?? null;
  const measured = !!widthCm && !!dropCm;
  const rodLengthCm = widthCm ? computeRodLengthCm(widthCm) : 0;
  const rodsPerWindow = rod ? (companion && !isDoubleRod(rod) ? 2 : 1) : 0;

  // ── Lines ─────────────────────────────────────────────────────────────────
  const curtainConfig = (role: CurtainRole, c?: string): Configuration => ({
    color: c, widthCm, dropCm, ...makeUp, setRole: role,
  });
  const lines = useMemo(() => {
    const out: (BuiltLine & { label: string; meters: number | null; total: number | null })[] = [];
    const add = (p: Product, config: Configuration, quantity: number, label: string) => {
      const priced = priceConfiguration(p, config, quantity);
      out.push({ product: p, config, quantity, label, meters: priced.meters, total: priced.lineTotal });
    };
    const roleLabel = (r: CurtainRole) => (r === 'HARD' ? tr('curtain.role_hard', 'Night curtain (rideau de nuit)') : tr('curtain.role_soft', 'Day curtain (rideau du jour)'));
    add(product, curtainConfig(mainRole, color), windows, roleLabel(mainRole));
    if (companion) add(companion, curtainConfig(companionRole, companionColor), windows, roleLabel(companionRole));
    if (rod) add(rod, { widthCm, setRole: 'ROD' }, rodsPerWindow * windows, tr('curtain.rod', 'Curtain rod'));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, companion, rod, widthCm, dropCm, color, companionColor, makeUp, windows, rodsPerWindow, t]);

  const total = lines.reduce((sum, l) => sum + (l.total ?? 0), 0);
  const hasQuoted = lines.some((l) => l.total == null);

  // ── Validation ────────────────────────────────────────────────────────────
  const errors = {
    width: !widthCm,
    drop: !dropCm,
    color: (product.colors?.length ?? 0) > 0 && !color,
    companionColor: !!companion && (companion.colors?.length ?? 0) > 0 && !companionColor,
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const shown = showErrors ? errors : { width: false, drop: false, color: false, companionColor: false };

  const submit = (buyNow: boolean) => {
    setShowErrors(true);
    if (hasErrors) {
      document.querySelector('[data-builder-error="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const setId = newSetId();
    onAdd(lines.map(({ product: p, config, quantity }) => ({ product: p, config: { ...config, setId }, quantity })), buyNow);
  };

  const primaryImage = (p: Product) => (p.images?.find((i) => i.isPrimary) || p.images?.[0])?.url;
  const perMeter = (p: Product) =>
    p.pricePerMeter != null
      ? tr('curtain.per_meter', '{{price}} / m', { price: money(p.pricePerMeter) })
      : p.salePrice ?? p.price
        ? money((p.salePrice ?? p.price)!)
        : tr('products.price_on_request', 'Price on request');

  const MainIcon = mainRole === 'HARD' ? Moon : Sun;
  const CompanionIcon = companionRole === 'HARD' ? Moon : Sun;

  return (
    <div className="space-y-8">
      {/* ① Window */}
      <Step
        n={1}
        title={tr('curtain.step_measure', 'Measure your window')}
        subtitle={tr('curtain.step_measure_sub', 'We calculate the fabric and the rod for you.')}
      >
        <div className="flex items-start gap-4">
          <div className="grid flex-1 grid-cols-2 items-end gap-3" data-builder-error={shown.width || shown.drop}>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{tr('curtain.window_width', 'Window width')} (cm)</span>
              <input
                type="number" inputMode="numeric" min={1} max={MAX_DIMENSION_CM} placeholder="200"
                value={widthCm ?? ''} onChange={(e) => setWidthCm(parseCm(e.target.value))}
                className={cn(fieldClass, shown.width && 'border-destructive')} aria-invalid={shown.width}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{tr('curtain.window_height', 'Height (rod to floor)')} (cm)</span>
              <input
                type="number" inputMode="numeric" min={1} max={MAX_DIMENSION_CM} placeholder="260"
                value={dropCm ?? ''} onChange={(e) => setDropCm(parseCm(e.target.value))}
                className={cn(fieldClass, shown.drop && 'border-destructive')} aria-invalid={shown.drop}
              />
            </label>
          </div>
          <div className="hidden sm:block"><WindowDiagram width={widthCm} height={dropCm} /></div>
        </div>
        {(shown.width || shown.drop) && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive" role="alert">
            <AlertCircle size={12} /> {tr('curtain.err_measure', 'Enter the width and height of your window.')}
          </p>
        )}

        {/* Immediate answer: how many metres. */}
        <div className="mt-4 grid gap-2 sm:grid-cols-2" aria-live="polite">
          <div className="flex items-center gap-3 rounded-xl bg-muted/60 px-4 py-3">
            <MainIcon size={18} className="text-primary" />
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">{lines[0].label}</p>
              <p className="text-lg font-semibold">{measured && lines[0].meters ? `${lines[0].meters} m` : '— m'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-muted/60 px-4 py-3">
            <Ruler size={18} className="text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">{tr('curtain.rod_length', 'Rod length')}</p>
              <p className="text-lg font-semibold">{widthCm ? `${rodLengthCm / 100} m` : '— m'}</p>
            </div>
          </div>
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info size={12} className="mt-0.5 shrink-0" />
          {tr('curtain.measure_note', 'Fabric = width × {{fullness}} (fullness) × (height + 30 cm hems). The rod is the width plus {{cm}} cm on each side. Our team confirms every measurement before cutting.', { fullness: makeUp.fullness, cm: ROD_OVERHANG_CM })}
        </p>
      </Step>

      {/* ② Colour */}
      {(product.colors?.length ?? 0) > 0 && (
        <Step n={2} title={tr('curtain.step_color', 'Choose the colour')}>
          <div data-builder-error={shown.color}>
            <ColorPicker product={product} value={color} onChange={setColor} error={shown.color} />
            {shown.color && <p className="mt-2 text-xs text-destructive" role="alert">{tr('config.err_color', 'Choose a colour')}</p>}
          </div>
        </Step>
      )}

      {/* ③ Companion curtain */}
      <Step
        n={(product.colors?.length ?? 0) > 0 ? 3 : 2}
        title={companionRole === 'SOFT'
          ? tr('curtain.ask_soft', 'Add a day curtain (rideau du jour)?')
          : tr('curtain.ask_hard', 'Add a night curtain (rideau de nuit)?')}
        subtitle={companionRole === 'SOFT'
          ? tr('curtain.ask_soft_sub', 'A light sheer that hangs in front of the window by day, behind the night curtain.')
          : tr('curtain.ask_hard_sub', 'A heavy curtain that closes at night for darkness and privacy.')}
      >
        <div className="grid gap-2">
          <OptionTile
            selected={!companion}
            onSelect={() => { setCompanionId(null); setCompanionColor(undefined); }}
            title={tr('curtain.no_thanks', 'No, only this curtain')}
          />
          {companions.map((p) => {
            const priced = measured ? priceConfiguration(p, curtainConfig(companionRole), windows) : null;
            return (
              <OptionTile
                key={p.id}
                selected={companion?.id === p.id}
                onSelect={() => { setCompanionId(p.id); setCompanionColor(p.colors?.length === 1 ? p.colors[0].name : undefined); }}
                image={primaryImage(p)}
                title={p.name}
                detail={priced?.meters ? `${priced.meters} m · ${perMeter(p)}` : perMeter(p)}
                price={priced?.lineTotal != null ? `+ ${money(priced.lineTotal)}` : undefined}
              />
            );
          })}
          {companions.length === 0 && (
            <p className="text-xs text-muted-foreground">{tr('curtain.no_companions', 'Ask us on WhatsApp for matching curtains in store.')}</p>
          )}
        </div>
        {companion && (companion.colors?.length ?? 0) > 1 && (
          <div className="mt-3 rounded-xl border border-border p-3" data-builder-error={shown.companionColor}>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold"><CompanionIcon size={13} /> {companion.name}</p>
            <ColorPicker product={companion} value={companionColor} onChange={setCompanionColor} error={shown.companionColor} />
          </div>
        )}
      </Step>

      {/* ④ Rod */}
      <Step
        n={(product.colors?.length ?? 0) > 0 ? 4 : 3}
        title={tr('curtain.step_rod', 'Curtain rod')}
        subtitle={widthCm
          ? (companion
              ? tr('curtain.rod_double', '{{m}} m — a double rod (or two rods) to hang both curtains.', { m: rodLengthCm / 100 })
              : tr('curtain.rod_single', '{{m}} m for your window.', { m: rodLengthCm / 100 }))
          : tr('curtain.rod_wait', 'Enter your window width to size the rod.')}
      >
        <div className="grid gap-2">
          <OptionTile selected={!rod} onSelect={() => setRodId(null)} title={tr('curtain.have_rod', 'I already have a rod')} />
          {rods.map((p) => {
            const count = companion && !isDoubleRod(p) ? 2 : 1;
            const priced = widthCm ? priceConfiguration(p, { widthCm, setRole: 'ROD' }, count * windows) : null;
            return (
              <OptionTile
                key={p.id}
                selected={rod?.id === p.id}
                onSelect={() => setRodId(p.id)}
                image={primaryImage(p)}
                title={p.name}
                detail={widthCm ? `${count > 1 ? `2 × ` : ''}${rodLengthCm / 100} m · ${perMeter(p)}` : perMeter(p)}
                price={priced?.lineTotal != null ? `+ ${money(priced.lineTotal)}` : undefined}
              />
            );
          })}
        </div>
      </Step>

      {/* ⑤ Finishing */}
      <div className="rounded-xl border border-border">
        <button
          type="button"
          onClick={() => setShowMakeUp((v) => !v)}
          aria-expanded={showMakeUp}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
        >
          <span>
            {tr('curtain.finishing', 'Finishing options')}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {tr(`config.panels.${makeUp.panelLayout}`, PANEL_LAYOUTS.find((c) => c.value === makeUp.panelLayout)?.label ?? '')} · {tr(`config.header.${makeUp.headerType}`, HEADER_TYPES.find((c) => c.value === makeUp.headerType)?.label ?? '')} · {makeUp.fullness}×
            </span>
          </span>
          <ChevronDown size={16} className={cn('transition-transform', showMakeUp && 'rotate-180')} />
        </button>
        {showMakeUp && (
          <div className="space-y-4 border-t border-border px-4 py-4">
            <ChoiceRow legend={tr('config.panels_label', 'Panels')} choices={PANEL_LAYOUTS} value={makeUp.panelLayout} onChange={(v) => setMakeUp((m) => ({ ...m, panelLayout: v }))} tr={tr} />
            <ChoiceRow legend={tr('config.header_label', 'Header type')} choices={HEADER_TYPES} value={makeUp.headerType} onChange={(v) => setMakeUp((m) => ({ ...m, headerType: v }))} tr={tr} />
            <ChoiceRow legend={tr('config.lining_label', 'Lining')} choices={LINING_TYPES} value={makeUp.lining} onChange={(v) => setMakeUp((m) => ({ ...m, lining: v }))} tr={tr} />
            <ChoiceRow legend={tr('config.fullness_label', 'Fullness')} choices={FULLNESS_CHOICES} value={String(makeUp.fullness)} onChange={(v) => setMakeUp((m) => ({ ...m, fullness: Number(v) }))} tr={tr} />
          </div>
        )}
      </div>

      {/* ⑥ Summary */}
      <div className="rounded-2xl bg-muted/50 p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="text-sm font-medium">{tr('curtain.windows', 'Number of windows this size')}</span>
          <div className="flex items-center rounded-full border border-border bg-background">
            <button type="button" onClick={() => setWindows((w) => Math.max(1, w - 1))} disabled={windows <= 1} aria-label={tr('cart.decrease', 'Decrease quantity')} className="p-2.5 disabled:opacity-40"><Minus size={14} /></button>
            <span className="w-8 text-center text-sm font-semibold">{windows}</span>
            <button type="button" onClick={() => setWindows((w) => Math.min(MAX_QUANTITY, w + 1))} aria-label={tr('cart.increase', 'Increase quantity')} className="p-2.5"><Plus size={14} /></button>
          </div>
        </div>

        <ul className="space-y-2 border-t border-border pt-3 text-sm" aria-live="polite">
          {lines.map((l) => (
            <li key={l.product.id + l.label} className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">{l.label}</span>
                <span className="block truncate font-medium">{l.product.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {l.meters ? `${l.config.setRole === 'ROD' && l.quantity > 1 ? `${l.quantity} × ` : ''}${l.meters} m` : ''}
                  {l.config.setRole !== 'ROD' && l.quantity > 1 ? ` × ${l.quantity}` : ''}
                </span>
              </span>
              <span className="shrink-0 font-semibold">{l.total != null ? (measured || l.config.setRole === 'ROD' ? money(l.total) : '—') : tr('products.price_on_request', 'Price on request')}</span>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
          <span className="font-semibold">{tr('config.estimated_total', 'Estimated total')}</span>
          <span className="text-2xl font-bold text-primary">{measured ? money(total) : '—'}</span>
        </div>
        {hasQuoted && (
          <p className="mt-2 text-xs text-muted-foreground">{tr('config.quote_note', 'This item is priced on request. Add it to your cart and our team will confirm the price before any payment.')}</p>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => submit(false)} disabled={!product.isAvailable} className="btn btn-primary w-full py-3.5">
            <ShoppingBag size={17} /> {tr('curtain.add_set', 'Add to cart')}
          </button>
          <button type="button" onClick={() => submit(true)} disabled={!product.isAvailable} className="btn btn-dark w-full py-3.5">
            <Zap size={17} /> {tr('products.buy_now', 'Buy Now')}
          </button>
        </div>
        {showErrors && hasErrors && (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-destructive" role="alert">
            <AlertCircle size={12} /> {tr('config.fix_errors', 'Please complete the highlighted options before adding to cart.')}
          </p>
        )}
      </div>
    </div>
  );
};

export default CurtainBuilder;
