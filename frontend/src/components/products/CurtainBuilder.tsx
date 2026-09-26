import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle, ArrowLeft, ArrowRight, Check, ChevronDown, DoorOpen, Info, Minus, Plus, ShoppingBag, AppWindow, Trash2, Zap,
} from 'lucide-react';
import { Product } from '../../types';
import { productsApi } from '../../lib/api';
import { WHATSAPP_LINK } from '../../lib/config';
import {
  ARRANGEMENTS, Arrangement, Configuration, CurtainRole, FULLNESS_CHOICES, HEADER_TYPES, LINING_TYPES, OptionChoice,
  ROD_OVERHANG_CM, computeRodLengthCm, curtainRole, detectKind, priceConfiguration,
} from '../../lib/productOptions';
import { cn } from '../../lib/utils';
import CurtainIllustration from './CurtainIllustration';

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

type OpeningKind = 'WINDOW' | 'DOOR';
interface Opening { id: number; kind: OpeningKind; width: string; height: string; count: number }
type StepId = 'measure' | 'style' | 'fullness' | 'rod' | 'review';
const STEPS: StepId[] = ['measure', 'style', 'fullness', 'rod', 'review'];

/** Largest opening accepted, in metres (the API caps dimensions at 20 m). */
const MAX_M = 20;

const money = (value: number) => `${Math.round(value).toLocaleString()} RWF`;
const newSetId = () => `set-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const parseM = (raw: string): number | null => {
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) && n > 0 && n <= MAX_M ? n : null;
};
const round1 = (n: number) => Math.round(n * 10) / 10;

/** A double rod is a single product; anything else is one rail, and a
 *  layered window needs two of them. */
const isDoubleRod = (rod: Product) => /double|dual|2 ?rail/i.test(rod.name);
const primaryImage = (p: Product) => (p.images?.find((i) => i.isPrimary) || p.images?.[0])?.url;
const swatchOf = (p: Product | null | undefined, colorName?: string) =>
  p?.colors?.find((c) => c.name === colorName)?.hexCode || p?.colors?.[0]?.hexCode || undefined;

const fieldClass =
  'h-12 w-full rounded-xl border border-input bg-background px-3 text-base font-medium focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/15 sm:text-sm';

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

/** Selectable picture card (arrangement, fullness). */
const PictureCard = ({ selected, onSelect, children, title, detail }: { selected: boolean; onSelect: () => void; children: React.ReactNode; title: string; detail?: React.ReactNode }) => (
  <button
    type="button"
    onClick={onSelect}
    aria-pressed={selected}
    className={cn(
      'group relative flex flex-col overflow-hidden rounded-xl border text-left transition-all',
      selected ? 'border-foreground ring-2 ring-foreground' : 'border-border hover:border-foreground/40'
    )}
  >
    <span className="block bg-muted">{children}</span>
    <span className="block px-3 py-2.5">
      <span className="block text-[13px] font-semibold leading-snug">{title}</span>
      {detail && <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span>}
    </span>
    {selected && (
      <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background shadow">
        <Check size={13} />
      </span>
    )}
  </button>
);

/** Selectable product row (companion curtain, rod). */
const ProductTile = ({ selected, onSelect, image, title, detail, price }: { selected: boolean; onSelect: () => void; image?: string; title: string; detail?: string; price?: string }) => (
  <button
    type="button"
    onClick={onSelect}
    aria-pressed={selected}
    className={cn(
      'flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-all',
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

const ChoiceRow = ({ legend, choices, value, onChange, tr }: { legend: string; choices: OptionChoice[]; value?: string; onChange: (v: string) => void; tr: (k: string, d: string) => string }) => (
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
 * The curtain buying flow, one decision per step:
 *   1. measure every window and door (metres),
 *   2. choose how night (rideau de nuit) and day (rideau du jour) curtains are
 *      arranged — from pictures — and the colours / matching curtain,
 *   3. choose the fullness (fronce / igikubo), again from pictures drawn in
 *      the chosen arrangement, each showing the metres it needs,
 *   4. choose a rod, already sized from the measurements,
 *   5. review and add everything to the cart.
 * Prices are estimates from `lib/productOptions.ts`; the server re-prices
 * every line with the same rules at checkout.
 */
const CurtainBuilder = ({ product, onAdd }: CurtainBuilderProps) => {
  const { t } = useTranslation();
  const tr = (key: string, fallback: string, vars?: Record<string, unknown>) => t(key, { defaultValue: fallback, ...vars });

  const mainRole: CurtainRole = curtainRole(product);
  const companionRole: CurtainRole = mainRole === 'HARD' ? 'SOFT' : 'HARD';

  const [step, setStep] = useState<StepId>('measure');
  const [reached, setReached] = useState(0);
  const [openings, setOpenings] = useState<Opening[]>([{ id: 1, kind: 'WINDOW', width: '', height: '', count: 1 }]);
  const [arrangement, setArrangement] = useState<Arrangement | null>(null);
  const [color, setColor] = useState<string | undefined>(product.colors?.length === 1 ? product.colors[0].name : undefined);
  const [companionId, setCompanionId] = useState<string | null>(null);
  const [companionColor, setCompanionColor] = useState<string | undefined>();
  const [fullness, setFullness] = useState<number | null>(null);
  const [rodId, setRodId] = useState<string | null | undefined>(undefined);
  const [finish, setFinish] = useState({ headerType: 'EYELET', lining: 'NONE' });
  const [showFinish, setShowFinish] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  // ── Catalogue for the companion curtain and the rods ──────────────────────
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

  // ── Derived ────────────────────────────────────────────────────────────────
  const arrangementIds: Arrangement[] = mainRole === 'HARD'
    ? ['NIGHT_ONLY', 'LAYERED', 'DAY_CENTER', 'NIGHT_CENTER', 'SIDE_BY_SIDE']
    : ['DAY_ONLY', 'LAYERED', 'DAY_CENTER', 'NIGHT_CENTER', 'SIDE_BY_SIDE'];
  const arr = arrangement ? ARRANGEMENTS[arrangement] : null;
  const needsCompanion = !!arr && arr.hard > 0 && arr.soft > 0;
  const companion = needsCompanion ? companions.find((p) => p.id === companionId) ?? null : null;
  const hardProduct = mainRole === 'HARD' ? product : companion;
  const softProduct = mainRole === 'SOFT' ? product : companion;
  const hardColorName = mainRole === 'HARD' ? color : companionColor;
  const softColorName = mainRole === 'SOFT' ? color : companionColor;
  const rod = rodId ? rods.find((p) => p.id === rodId) ?? null : null;

  const measured = openings.map((o) => ({ ...o, w: parseM(o.width), h: parseM(o.height) }));
  const measuresValid = measured.every((o) => o.w && o.h);
  const openingLabel = (o: Opening) => {
    const n = openings.filter((x) => x.kind === o.kind && x.id <= o.id).length;
    return o.kind === 'DOOR' ? tr('curtain.door_n', 'Door {{n}}', { n }) : tr('curtain.window_n', 'Window {{n}}', { n });
  };

  /** Every cart line the current choices produce, one set per opening. */
  const buildLines = (full: number | null, withRod: boolean) => {
    const lines: (BuiltLine & { role: 'HARD' | 'SOFT' | 'ROD'; openingId: number; meters: number | null; total: number | null })[] = [];
    if (!arr || !measuresValid) return lines;
    measured.forEach((o) => {
      const base = { widthCm: Math.round(o.w! * 100), dropCm: Math.round(o.h! * 100), arrangement: arrangement!, openingLabel: openingLabel(o) };
      const add = (p: Product, config: Configuration, qty: number, role: 'HARD' | 'SOFT' | 'ROD') => {
        const priced = priceConfiguration(p, config, qty);
        lines.push({ product: p, config, quantity: qty, role, openingId: o.id, meters: priced.meters, total: priced.lineTotal });
      };
      const curtainCfg = (role: CurtainRole, colorName?: string): Configuration => ({
        ...base, color: colorName, fullness: full ?? 2, ...finish,
        panelLayout: (role === 'HARD' ? arr.hardPanels : arr.softPanels) ?? 'PAIR', setRole: role,
      });
      if (arr.hard > 0 && hardProduct) add(hardProduct, curtainCfg('HARD', hardColorName), o.count, 'HARD');
      if (arr.soft > 0 && softProduct) add(softProduct, curtainCfg('SOFT', softColorName), o.count, 'SOFT');
      if (withRod && rod) {
        const perOpening = arr.rod === 'DOUBLE' && !isDoubleRod(rod) ? 2 : 1;
        add(rod, { widthCm: base.widthCm, arrangement: arrangement!, openingLabel: base.openingLabel, setRole: 'ROD' }, perOpening * o.count, 'ROD');
      }
    });
    return lines;
  };

  const metersFor = (full: number) => {
    const lines = buildLines(full, false);
    const sum = (role: 'HARD' | 'SOFT') => round1(lines.filter((l) => l.role === role).reduce((s, l) => s + (l.meters ?? 0) * l.quantity, 0));
    const total = lines.reduce((s, l) => s + (l.total ?? 0), 0);
    return { hard: sum('HARD'), soft: sum('SOFT'), total };
  };

  const lines = useMemo(() => buildLines(fullness, true),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [openings, arrangement, companion, color, companionColor, fullness, rod, finish, t]);
  const total = lines.reduce((s, l) => s + (l.total ?? 0), 0);
  const hasQuoted = lines.some((l) => l.total == null);

  // ── Step validation ───────────────────────────────────────────────────────
  const stepErrors: Record<StepId, string | null> = {
    measure: measuresValid ? null : tr('curtain.err_measure_m', 'Enter the width and height of every window or door, in metres (for example 2.4).'),
    style: !arrangement
      ? tr('curtain.err_arrangement', 'Choose how you want the curtains arranged.')
      : (product.colors?.length ?? 0) > 0 && !color
        ? tr('config.err_color', 'Choose a colour')
        : needsCompanion && !companion
          ? (companionRole === 'SOFT' ? tr('curtain.err_pick_soft', 'Choose the day curtain.') : tr('curtain.err_pick_hard', 'Choose the night curtain.'))
          : companion && (companion.colors?.length ?? 0) > 0 && !companionColor
            ? tr('curtain.err_companion_color', 'Choose a colour for the second curtain.')
            : null,
    fullness: fullness ? null : tr('curtain.err_fullness', 'Choose the fullness.'),
    rod: rodId === undefined ? tr('curtain.err_rod', 'Choose a rod, or tell us you already have one.') : null,
    review: null,
  };
  const index = STEPS.indexOf(step);

  const goTo = (target: StepId) => {
    setShowErrors(false);
    setStep(target);
    document.getElementById('curtain-builder')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const next = () => {
    if (stepErrors[step]) { setShowErrors(true); return; }
    const n = Math.min(index + 1, STEPS.length - 1);
    setReached((r) => Math.max(r, n));
    goTo(STEPS[n]);
  };

  const submit = (buyNow: boolean) => {
    const setId = newSetId();
    onAdd(lines.map(({ product: p, config, quantity }) => ({ product: p, config: { ...config, setId }, quantity })), buyNow);
  };

  const updateOpening = (id: number, patch: Partial<Opening>) =>
    setOpenings((list) => list.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  const addOpening = (kind: OpeningKind) =>
    setOpenings((list) => [...list, { id: Math.max(...list.map((o) => o.id)) + 1, kind, width: '', height: kind === 'DOOR' ? '2.2' : '', count: 1 }]);

  const perMeter = (p: Product) =>
    p.pricePerMeter != null ? tr('curtain.per_meter', '{{price}} / m', { price: money(p.pricePerMeter) })
      : p.salePrice ?? p.price ? money((p.salePrice ?? p.price)!) : tr('products.price_on_request', 'Price on request');

  const hardSwatch = swatchOf(hardProduct, hardColorName);
  const softSwatch = swatchOf(softProduct, softColorName);
  const stepTitles: Record<StepId, string> = {
    measure: tr('curtain.s_measure', 'Measure'),
    style: tr('curtain.s_style', 'Style'),
    fullness: tr('curtain.s_fullness', 'Fullness'),
    rod: tr('curtain.s_rod', 'Rod'),
    review: tr('curtain.s_review', 'Review'),
  };

  return (
    <div id="curtain-builder" className="scroll-mt-40">
      {/* Progress */}
      <ol className="mb-6 grid grid-cols-5 gap-1.5" aria-label={tr('curtain.progress', 'Steps')}>
        {STEPS.map((s, i) => {
          const done = i < index;
          const reachable = i <= reached;
          return (
            <li key={s}>
              <button
                type="button"
                disabled={!reachable}
                onClick={() => reachable && goTo(s)}
                aria-current={s === step ? 'step' : undefined}
                className="group w-full text-left disabled:cursor-default"
              >
                <span className={cn('block h-1 rounded-full', i <= index ? 'bg-foreground' : 'bg-border')} />
                <span className={cn('mt-1.5 flex items-center gap-1 text-[11px] font-medium', s === step ? 'text-foreground' : 'text-muted-foreground')}>
                  {done && <Check size={11} />} <span className="truncate">{stepTitles[s]}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* ① Measure */}
      {step === 'measure' && (
        <section>
          <h3 className="text-lg font-semibold">{tr('curtain.q_measure', 'Measure your windows and doors')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {tr('curtain.q_measure_sub', 'In metres. Width of the opening, and height from where the rod will hang down to where the curtain should end.')}
          </p>

          <ul className="mt-5 space-y-3">
            {openings.map((o) => {
              const m = measured.find((x) => x.id === o.id)!;
              const bad = showErrors && (!m.w || !m.h);
              return (
                <li key={o.id} className={cn('rounded-xl border p-3.5', bad ? 'border-destructive' : 'border-border')}>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex rounded-full bg-muted p-0.5 text-xs font-medium">
                      {(['WINDOW', 'DOOR'] as const).map((k) => (
                        <button key={k} type="button" onClick={() => updateOpening(o.id, { kind: k })}
                          className={cn('flex items-center gap-1.5 rounded-full px-3 py-1.5', o.kind === k ? 'bg-background shadow-sm' : 'text-muted-foreground')}>
                          {k === 'WINDOW' ? <AppWindow size={13} /> : <DoorOpen size={13} />}
                          {k === 'WINDOW' ? tr('curtain.window', 'Window') : tr('curtain.door', 'Door')}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground">{openingLabel(o)}</span>
                    {openings.length > 1 && (
                      <button type="button" onClick={() => setOpenings((l) => l.filter((x) => x.id !== o.id))} className="icon-btn h-8 w-8" aria-label={tr('curtain.remove_opening', 'Remove')}>
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-muted-foreground">{tr('curtain.width_m', 'Width (m)')}</span>
                      <input type="text" inputMode="decimal" placeholder="2.40" value={o.width}
                        onChange={(e) => updateOpening(o.id, { width: e.target.value })} className={fieldClass} aria-invalid={bad && !m.w} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-muted-foreground">{tr('curtain.height_m', 'Height (m)')}</span>
                      <input type="text" inputMode="decimal" placeholder="2.60" value={o.height}
                        onChange={(e) => updateOpening(o.id, { height: e.target.value })} className={fieldClass} aria-invalid={bad && !m.h} />
                    </label>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{tr('curtain.same_size', 'How many of this size?')}</span>
                    <div className="flex items-center rounded-full border border-border">
                      <button type="button" onClick={() => updateOpening(o.id, { count: Math.max(1, o.count - 1) })} disabled={o.count <= 1} className="p-2 disabled:opacity-40" aria-label={tr('cart.decrease', 'Decrease quantity')}><Minus size={13} /></button>
                      <span className="w-6 text-center text-sm font-semibold text-foreground">{o.count}</span>
                      <button type="button" onClick={() => updateOpening(o.id, { count: Math.min(50, o.count + 1) })} className="p-2" aria-label={tr('cart.increase', 'Increase quantity')}><Plus size={13} /></button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => addOpening('WINDOW')} className="btn btn-outline btn-sm"><Plus size={14} /> {tr('curtain.add_window', 'Add a window')}</button>
            <button type="button" onClick={() => addOpening('DOOR')} className="btn btn-outline btn-sm"><Plus size={14} /> {tr('curtain.add_door', 'Add a door')}</button>
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info size={12} className="mt-0.5 shrink-0" />
            {tr('curtain.measure_trust', 'Not sure? Measure as well as you can — our team confirms every measurement before cutting.')}
          </p>
        </section>
      )}

      {/* ② Style */}
      {step === 'style' && (
        <section>
          <h3 className="text-lg font-semibold">{tr('curtain.q_style', 'How should the curtains hang?')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{tr('curtain.q_style_sub', 'Choose the arrangement of night curtain (rideau de nuit) and day curtain (rideau du jour).')}</p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {arrangementIds.map((id) => (
              <PictureCard key={id} selected={arrangement === id} onSelect={() => { setArrangement(id); setFullness(null); }}
                title={tr(`curtain.arr_${id}`, ARRANGEMENTS[id].label)}
                detail={ARRANGEMENTS[id].rod === 'DOUBLE' ? tr('curtain.double_rod', 'Double rod') : undefined}>
                <CurtainIllustration arrangement={id} hardColor={hardSwatch} softColor={softSwatch} className="aspect-[4/3] w-full" />
              </PictureCard>
            ))}
          </div>

          {(product.colors?.length ?? 0) > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-semibold">{tr('curtain.color_of', 'Colour — {{name}}', { name: product.name })}</p>
              <ColorPicker product={product} value={color} onChange={setColor} error={showErrors && !color} />
            </div>
          )}

          {needsCompanion && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-semibold">
                {companionRole === 'SOFT' ? tr('curtain.pick_soft', 'Choose the day curtain (rideau du jour)') : tr('curtain.pick_hard', 'Choose the night curtain (rideau de nuit)')}
              </p>
              <div className="grid gap-2">
                {companions.map((p) => (
                  <ProductTile key={p.id} selected={companion?.id === p.id}
                    onSelect={() => { setCompanionId(p.id); setCompanionColor(p.colors?.length === 1 ? p.colors[0].name : undefined); }}
                    image={primaryImage(p)} title={p.name} detail={perMeter(p)} />
                ))}
                {companions.length === 0 && (
                  <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground hover:text-foreground">
                    {tr('curtain.no_companions', 'Ask us on WhatsApp for matching curtains in store.')}
                  </a>
                )}
              </div>
              {companion && (companion.colors?.length ?? 0) > 1 && (
                <div className="mt-3 rounded-xl border border-border p-3">
                  <p className="mb-2 text-xs font-semibold">{tr('curtain.color_of', 'Colour — {{name}}', { name: companion.name })}</p>
                  <ColorPicker product={companion} value={companionColor} onChange={setCompanionColor} error={showErrors && !companionColor} />
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ③ Fullness */}
      {step === 'fullness' && arrangement && (
        <section>
          <h3 className="text-lg font-semibold">{tr('curtain.q_fullness', 'How full should the folds be?')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{tr('curtain.q_fullness_sub', 'Fronce / igikubo: more folds look richer and use more fabric. The metres for your measurements are shown under each choice.')}</p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {FULLNESS_CHOICES.map((c) => {
              const f = Number(c.value);
              const m = metersFor(f);
              return (
                <PictureCard key={c.value} selected={fullness === f} onSelect={() => setFullness(f)}
                  title={tr(c.labelKey, c.label)}
                  detail={
                    <>
                      {m.hard > 0 && <span className="block">{tr('curtain.night_m', 'Night curtain: {{m}} m', { m: m.hard })}</span>}
                      {m.soft > 0 && <span className="block">{tr('curtain.day_m', 'Day curtain: {{m}} m', { m: m.soft })}</span>}
                      {m.total > 0 && <span className="mt-0.5 block font-semibold text-foreground">{money(m.total)}</span>}
                    </>
                  }>
                  <CurtainIllustration arrangement={arrangement} fullness={f} hardColor={hardSwatch} softColor={softSwatch} className="aspect-[4/3] w-full" />
                </PictureCard>
              );
            })}
          </div>
        </section>
      )}

      {/* ④ Rod */}
      {step === 'rod' && arr && (
        <section>
          <h3 className="text-lg font-semibold">{tr('curtain.q_rod', 'Choose your rod')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {arr.rod === 'DOUBLE'
              ? tr('curtain.rod_double_sub', 'Your arrangement needs a double rod (two rails): one for each curtain. Each rod is the width plus {{cm}} cm on each side.', { cm: ROD_OVERHANG_CM })
              : tr('curtain.rod_single_sub', 'One rod per opening, the width plus {{cm}} cm on each side.', { cm: ROD_OVERHANG_CM })}
          </p>
          <ul className="mt-3 flex flex-wrap gap-2 text-xs">
            {measured.map((o) => (
              <li key={o.id} className="rounded-full bg-muted px-3 py-1.5">
                {openingLabel(o)}: <span className="font-semibold">{computeRodLengthCm(Math.round(o.w! * 100)) / 100} m</span>{o.count > 1 ? ` × ${o.count}` : ''}
              </li>
            ))}
          </ul>
          <div className="mt-4 grid gap-2">
            <ProductTile selected={rodId === null} onSelect={() => setRodId(null)} title={tr('curtain.have_rod', 'I already have a rod')} />
            {rods.map((p) => {
              const rodLines = buildLines(fullness, false).length ? (() => {
                const count = arr.rod === 'DOUBLE' && !isDoubleRod(p) ? 2 : 1;
                return measured.reduce((s, o) => s + (priceConfiguration(p, { widthCm: Math.round(o.w! * 100), setRole: 'ROD' }, count * o.count).lineTotal ?? 0), 0);
              })() : 0;
              return (
                <ProductTile key={p.id} selected={rodId === p.id} onSelect={() => setRodId(p.id)}
                  image={primaryImage(p)} title={p.name}
                  detail={`${perMeter(p)}${arr.rod === 'DOUBLE' && !isDoubleRod(p) ? ` · ${tr('curtain.two_per_opening', '2 per opening')}` : ''}`}
                  price={rodLines ? `+ ${money(rodLines)}` : undefined} />
              );
            })}
          </div>
        </section>
      )}

      {/* ⑤ Review */}
      {step === 'review' && arr && (
        <section>
          <h3 className="text-lg font-semibold">{tr('curtain.q_review', 'Your curtains')}</h3>
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-muted/60 p-3">
            <CurtainIllustration arrangement={arrangement!} fullness={fullness ?? 2} hardColor={hardSwatch} softColor={softSwatch} className="h-16 w-20 shrink-0 rounded-md" />
            <div className="min-w-0 text-sm">
              <p className="font-semibold">{tr(`curtain.arr_${arrangement}`, arr.label)}</p>
              <p className="text-xs text-muted-foreground">{tr(FULLNESS_CHOICES.find((c) => Number(c.value) === fullness)?.labelKey ?? '', FULLNESS_CHOICES.find((c) => Number(c.value) === fullness)?.label ?? '')}</p>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {measured.map((o) => {
              const own = lines.filter((l) => l.openingId === o.id);
              return (
                <div key={o.id}>
                  <p className="mb-1.5 text-xs text-muted-foreground">
                    <span className="font-semibold uppercase tracking-wide">{openingLabel(o)}</span> · {o.w} × {o.h} m{o.count > 1 ? ` · × ${o.count}` : ''}
                  </p>
                  <ul className="divide-y divide-border rounded-xl border border-border">
                    {own.map((l, i) => (
                      <li key={i} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
                        <span className="min-w-0">
                          <span className="block text-xs text-muted-foreground">
                            {l.role === 'HARD' ? tr('curtain.role_hard', 'Night curtain (rideau de nuit)') : l.role === 'SOFT' ? tr('curtain.role_soft', 'Day curtain (rideau du jour)') : tr('curtain.rod', 'Curtain rod')}
                          </span>
                          <span className="line-clamp-2 block font-medium">{l.product.name}{l.config.color ? ` · ${l.config.color}` : ''}</span>
                          <span className="block text-xs text-muted-foreground">
                            {l.meters ? `${l.role === 'ROD' && l.quantity > 1 ? `${l.quantity} × ` : ''}${l.meters} m` : ''}
                            {l.role !== 'ROD' && l.quantity > 1 ? ` × ${l.quantity}` : ''}
                          </span>
                        </span>
                        <span className="shrink-0 font-semibold">{l.total != null ? money(l.total) : tr('products.price_on_request', 'Price on request')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-xl border border-border">
            <button type="button" onClick={() => setShowFinish((v) => !v)} aria-expanded={showFinish} className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium">
              <span>
                {tr('curtain.finishing', 'Finishing options')}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {tr(`config.header.${finish.headerType}`, HEADER_TYPES.find((c) => c.value === finish.headerType)?.label ?? '')} · {tr(`config.lining.${finish.lining}`, LINING_TYPES.find((c) => c.value === finish.lining)?.label ?? '')}
                </span>
              </span>
              <ChevronDown size={16} className={cn('transition-transform', showFinish && 'rotate-180')} />
            </button>
            {showFinish && (
              <div className="space-y-4 border-t border-border px-4 py-4">
                <ChoiceRow legend={tr('config.header_label', 'Header type')} choices={HEADER_TYPES} value={finish.headerType} onChange={(v) => setFinish((f) => ({ ...f, headerType: v }))} tr={tr} />
                <ChoiceRow legend={tr('config.lining_label', 'Lining')} choices={LINING_TYPES} value={finish.lining} onChange={(v) => setFinish((f) => ({ ...f, lining: v }))} tr={tr} />
              </div>
            )}
          </div>

          <div className="mt-5 flex items-baseline justify-between border-t border-border pt-4">
            <span className="font-semibold">{tr('config.estimated_total', 'Estimated total')}</span>
            <span className="text-2xl font-bold text-primary">{money(total)}</span>
          </div>
          {hasQuoted && <p className="mt-2 text-xs text-muted-foreground">{tr('config.quote_note', 'This item is priced on request. Add it to your cart and our team will confirm the price before any payment.')}</p>}

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => submit(false)} disabled={!product.isAvailable} className="btn btn-primary w-full py-3.5">
              <ShoppingBag size={17} /> {tr('curtain.add_set', 'Add to cart')}
            </button>
            <button type="button" onClick={() => submit(true)} disabled={!product.isAvailable} className="btn btn-dark w-full py-3.5">
              <Zap size={17} /> {tr('products.buy_now', 'Buy Now')}
            </button>
          </div>
        </section>
      )}

      {/* Navigation */}
      {showErrors && stepErrors[step] && (
        <p className="mt-4 flex items-start gap-1.5 text-sm text-destructive" role="alert">
          <AlertCircle size={15} className="mt-0.5 shrink-0" /> {stepErrors[step]}
        </p>
      )}
      {step !== 'review' && (
        <div className="mt-6 flex items-center gap-2">
          {index > 0 && (
            <button type="button" onClick={() => goTo(STEPS[index - 1])} className="btn btn-outline px-4" aria-label={tr('common.back', 'Back')}>
              <ArrowLeft size={16} />
            </button>
          )}
          <button type="button" onClick={next} className="btn btn-dark flex-1 py-3.5">
            {tr('curtain.continue', 'Continue')} <ArrowRight size={16} />
          </button>
        </div>
      )}
      {step === 'review' && (
        <button type="button" onClick={() => goTo('rod')} className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} /> {tr('common.back', 'Back')}
        </button>
      )}
      {index >= 2 && step !== 'review' && fullness && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          {tr('curtain.running_total', 'So far: {{total}}', { total: money(total) })}
        </p>
      )}
    </div>
  );
};

export default CurtainBuilder;
