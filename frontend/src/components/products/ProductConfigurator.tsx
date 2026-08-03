import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Info, Minus, Plus, Ruler, ShoppingBag, AlertCircle } from 'lucide-react';
import { Product } from '../../types';
import {
  Configuration, ConfigurationErrors, FULLNESS_CHOICES, HEADER_TYPES, LINING_TYPES,
  MAX_DIMENSION_CM, MAX_METERS, MAX_QUANTITY, PANEL_LAYOUTS, OptionChoice,
  defaultConfiguration, fieldsFor, priceConfiguration, validate,
} from '../../lib/productOptions';
import { cn } from '../../lib/utils';

interface ProductConfiguratorProps {
  product: Product;
  /** Seeded when editing a line that is already in the cart. */
  initialConfig?: Configuration;
  initialQuantity?: number;
  mode?: 'add' | 'edit';
  onSubmit: (config: Configuration, quantity: number) => void;
  /** Keeps the button in a pending state while the parent navigates away. */
  submitting?: boolean;
}

const fieldClass =
  'w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';

const FieldError = ({ message }: { message?: string }) =>
  message ? (
    <p className="flex items-center gap-1.5 text-xs text-destructive mt-1.5" role="alert">
      <AlertCircle size={12} className="shrink-0" /> {message}
    </p>
  ) : null;

/** Radio group rendered as cards. Keyboard and screen-reader behaviour comes
 *  from the real inputs underneath — the cards are only the visible layer. */
const ChoiceGroup = ({
  name, legend, choices, value, onChange, error, columns = 2, translate,
}: {
  name: string;
  legend: string;
  choices: OptionChoice[];
  value?: string;
  onChange: (value: string) => void;
  error?: string;
  columns?: 2 | 3 | 4;
  translate: (key: string, fallback: string) => string;
}) => (
  <fieldset>
    <legend className="text-sm font-medium mb-2">{legend}</legend>
    <div
      className={cn(
        'grid gap-2',
        columns === 2 && 'grid-cols-1 sm:grid-cols-2',
        columns === 3 && 'grid-cols-2 sm:grid-cols-3',
        columns === 4 && 'grid-cols-2 sm:grid-cols-4',
      )}
    >
      {choices.map((choice) => {
        const selected = value === choice.value;
        return (
          <label
            key={choice.value}
            className={cn(
              'relative flex flex-col gap-0.5 p-3 border-2 rounded-xl cursor-pointer transition-colors',
              'focus-within:ring-2 focus-within:ring-primary/40',
              selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
            )}
          >
            <input
              type="radio"
              name={name}
              value={choice.value}
              checked={selected}
              onChange={() => onChange(choice.value)}
              className="sr-only"
            />
            <span className="flex items-center gap-1.5 text-sm font-medium">
              {selected && <Check size={13} className="text-primary shrink-0" />}
              {translate(choice.labelKey, choice.label)}
            </span>
            {choice.description && (
              <span className="text-xs text-muted-foreground leading-snug">
                {translate(`${choice.labelKey}_desc`, choice.description)}
              </span>
            )}
          </label>
        );
      })}
    </div>
    <FieldError message={error} />
  </fieldset>
);

/**
 * Everything the customer decides before the product reaches the cart.
 *
 * Which controls appear is derived from the product itself (see
 * `lib/productOptions.ts`): a curtain asks for dimensions and make-up, fabric
 * sold by the metre asks for length, a simple item just asks how many. The
 * running total updates on every change so nobody has to reach the cart to
 * find out what something costs.
 */
const ProductConfigurator = ({
  product, initialConfig, initialQuantity = 1, mode = 'add', onSubmit, submitting = false,
}: ProductConfiguratorProps) => {
  const { t } = useTranslation();
  const tr = (key: string, fallback: string) => t(key, { defaultValue: fallback });

  const fields = useMemo(() => fieldsFor(product), [product]);
  const [config, setConfig] = useState<Configuration>(initialConfig ?? defaultConfiguration(product));
  const [quantity, setQuantity] = useState(initialQuantity);
  // Errors are only shown after a submit attempt: nagging someone about a field
  // they have not reached yet is noise, not help.
  const [showErrors, setShowErrors] = useState(false);

  const errors: ConfigurationErrors = useMemo(() => validate(product, config), [product, config]);
  const visibleErrors = showErrors ? errors : {};
  const priced = useMemo(() => priceConfiguration(product, config, quantity), [product, config, quantity]);

  const set = <K extends keyof Configuration>(key: K, value: Configuration[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const parseDimension = (raw: string, max: number): number | undefined => {
    if (raw.trim() === '') return undefined;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return undefined;
    return Math.min(n, max);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowErrors(true);
    if (Object.keys(errors).length > 0) {
      // Put the customer on the first thing that needs fixing rather than
      // leaving them to hunt for the red text.
      document.querySelector<HTMLElement>('[data-config-error="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    onSubmit(config, quantity);
  };

  const money = (value: number) => `${value.toLocaleString()} ${product.currency || 'RWF'}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* ── Colour ─────────────────────────────────────────────────────────── */}
      {fields.color && (
        <fieldset data-config-error={!!visibleErrors.color}>
          <legend className="text-sm font-medium mb-2">
            {tr('config.color', 'Colour')} <span className="text-destructive">*</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {product.colors.map((color) => {
              const selected = config.color === color.name;
              return (
                <label
                  key={color.id}
                  className={cn(
                    'flex items-center gap-2 pl-2 pr-3 py-2 border-2 rounded-full cursor-pointer transition-colors text-xs',
                    'focus-within:ring-2 focus-within:ring-primary/40',
                    selected ? 'border-primary bg-primary/5 font-medium' : 'border-border hover:border-primary/40',
                  )}
                >
                  <input
                    type="radio" name="color" value={color.name} checked={selected}
                    onChange={() => set('color', color.name)} className="sr-only"
                  />
                  <span
                    className="w-5 h-5 rounded-full border border-border shrink-0"
                    style={{ backgroundColor: color.hexCode || '#ccc' }}
                    aria-hidden
                  />
                  {color.name}
                  {selected && <Check size={12} className="text-primary" />}
                </label>
              );
            })}
          </div>
          <FieldError message={visibleErrors.color} />
        </fieldset>
      )}

      {/* ── Curtain dimensions ─────────────────────────────────────────────── */}
      {fields.dimensions && (
        <div data-config-error={!!(visibleErrors.widthCm || visibleErrors.dropCm)}>
          <div className="flex items-center gap-2 mb-2">
            <Ruler size={15} className="text-primary" />
            <h3 className="text-sm font-medium">{tr('config.measurements', 'Measurements')}</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="config-width" className="text-sm block mb-1.5 text-muted-foreground">
                {tr('config.width', 'Curtain width')} (cm) <span className="text-destructive">*</span>
              </label>
              <input
                id="config-width" type="number" inputMode="decimal" min={1} max={MAX_DIMENSION_CM} step="1"
                value={config.widthCm ?? ''} placeholder="200"
                onChange={(e) => set('widthCm', parseDimension(e.target.value, MAX_DIMENSION_CM))}
                className={cn(fieldClass, visibleErrors.widthCm && 'border-destructive')}
                aria-invalid={!!visibleErrors.widthCm}
              />
              <FieldError message={visibleErrors.widthCm} />
            </div>
            <div>
              <label htmlFor="config-drop" className="text-sm block mb-1.5 text-muted-foreground">
                {tr('config.length', 'Curtain length / drop')} (cm) <span className="text-destructive">*</span>
              </label>
              <input
                id="config-drop" type="number" inputMode="decimal" min={1} max={MAX_DIMENSION_CM} step="1"
                value={config.dropCm ?? ''} placeholder="250"
                onChange={(e) => set('dropCm', parseDimension(e.target.value, MAX_DIMENSION_CM))}
                className={cn(fieldClass, visibleErrors.dropCm && 'border-destructive')}
                aria-invalid={!!visibleErrors.dropCm}
              />
              <FieldError message={visibleErrors.dropCm} />
            </div>
          </div>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground mt-2">
            <Info size={12} className="shrink-0 mt-0.5" />
            {tr('config.measure_hint', 'Measure the rail or track width, and from the rail down to where the curtain should end. Not sure? Order anyway — our team confirms every measurement before cutting.')}
          </p>
        </div>
      )}

      {/* ── Fabric length (cut-to-length products) ─────────────────────────── */}
      {fields.meters && (
        <div data-config-error={!!visibleErrors.meters}>
          <label htmlFor="config-meters" className="text-sm font-medium block mb-1.5">
            {tr('config.meters', 'How many meters?')} <span className="text-destructive">*</span>
          </label>
          <input
            id="config-meters" type="number" inputMode="decimal" min={0.1} max={MAX_METERS} step="0.1"
            value={config.meters ?? ''} placeholder="3.5"
            onChange={(e) => set('meters', parseDimension(e.target.value, MAX_METERS))}
            className={cn(fieldClass, visibleErrors.meters && 'border-destructive')}
            aria-invalid={!!visibleErrors.meters}
          />
          <FieldError message={visibleErrors.meters} />
        </div>
      )}

      {/* ── Curtain make-up ────────────────────────────────────────────────── */}
      {fields.curtainMakeUp && (
        <>
          <div data-config-error={!!visibleErrors.panelLayout}>
            <ChoiceGroup
              name="panelLayout" legend={`${tr('config.panels_label', 'Panels')} *`} choices={PANEL_LAYOUTS}
              value={config.panelLayout} onChange={(v) => set('panelLayout', v)}
              error={visibleErrors.panelLayout} translate={tr}
            />
          </div>
          <div data-config-error={!!visibleErrors.headerType}>
            <ChoiceGroup
              name="headerType" legend={`${tr('config.header_label', 'Header type')} *`} choices={HEADER_TYPES}
              value={config.headerType} onChange={(v) => set('headerType', v)}
              error={visibleErrors.headerType} columns={3} translate={tr}
            />
          </div>
          <ChoiceGroup
            name="lining" legend={tr('config.lining_label', 'Lining')} choices={LINING_TYPES}
            value={config.lining} onChange={(v) => set('lining', v)} columns={2} translate={tr}
          />
          <div>
            <label htmlFor="config-fullness" className="text-sm font-medium block mb-1.5">
              {tr('config.fullness_label', 'Fullness')}
            </label>
            <select
              id="config-fullness" value={String(config.fullness ?? 2)}
              onChange={(e) => set('fullness', Number(e.target.value))}
              className={fieldClass}
            >
              {FULLNESS_CHOICES.map((choice) => (
                <option key={choice.value} value={choice.value}>{tr(choice.labelKey, choice.label)}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1.5">
              {tr('config.fullness_hint', 'How gathered the curtain looks. More fullness uses more fabric.')}
            </p>
          </div>
        </>
      )}

      {/* ── Notes ──────────────────────────────────────────────────────────── */}
      <div>
        <label htmlFor="config-notes" className="text-sm font-medium block mb-1.5">
          {tr('config.notes', 'Notes for this item')}
        </label>
        <textarea
          id="config-notes" rows={2} value={config.notes ?? ''}
          onChange={(e) => set('notes', e.target.value)}
          placeholder={tr('config.notes_placeholder', 'e.g. for the living room window facing the street')}
          className={cn(fieldClass, 'resize-none')}
          maxLength={500}
        />
      </div>

      {/* ── Quantity + running total ───────────────────────────────────────── */}
      <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <span className="text-sm font-medium">{tr('config.quantity', 'Quantity')}</span>
          <div className="flex items-center border border-border rounded-xl bg-background">
            <button
              type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label={tr('cart.decrease', 'Decrease quantity')}
              className="p-2.5 text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
            >
              <Minus size={15} />
            </button>
            <input
              type="number" min={1} max={MAX_QUANTITY} value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(MAX_QUANTITY, Math.floor(Number(e.target.value)) || 1)))}
              aria-label={tr('config.quantity', 'Quantity')}
              className="w-14 text-center bg-transparent text-sm font-medium focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              type="button" onClick={() => setQuantity((q) => Math.min(MAX_QUANTITY, q + 1))}
              disabled={quantity >= MAX_QUANTITY}
              aria-label={tr('cart.increase', 'Increase quantity')}
              className="p-2.5 text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
            >
              <Plus size={15} />
            </button>
          </div>
        </div>

        <div className="border-t border-border pt-3 space-y-1.5 text-sm" aria-live="polite">
          {priced.meters != null && priced.meters > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>{tr('config.fabric_needed', 'Fabric needed (each)')}</span>
              <span className="font-medium text-foreground">{priced.meters} m</span>
            </div>
          )}
          {priced.unitPrice != null && (
            <div className="flex justify-between text-muted-foreground">
              <span>{tr('config.unit_price', 'Price each')}</span>
              <span className="font-medium text-foreground">{money(priced.unitPrice)}</span>
            </div>
          )}
          {priced.lineTotal != null ? (
            <div className="flex justify-between items-baseline pt-1">
              <span className="font-semibold">{tr('config.estimated_total', 'Estimated total')}</span>
              <span className="text-xl font-bold text-primary">{money(priced.lineTotal)}</span>
            </div>
          ) : (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info size={12} className="shrink-0 mt-0.5" />
              {tr('config.quote_note', 'This item is priced on request. Add it to your cart and our team will confirm the price before any payment.')}
            </p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting || !product.isAvailable}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <ShoppingBag size={17} />
        {!product.isAvailable
          ? tr('products.out_of_stock', 'Out of Stock')
          : mode === 'edit'
            ? tr('cart.update_item', 'Update cart')
            : tr('products.add_to_cart', 'Add to Cart')}
      </button>

      {showErrors && Object.keys(errors).length > 0 && (
        <p className="flex items-center justify-center gap-1.5 text-xs text-destructive" role="alert">
          <AlertCircle size={12} />
          {tr('config.fix_errors', 'Please complete the highlighted options before adding to cart.')}
        </p>
      )}
    </form>
  );
};

export default ProductConfigurator;
