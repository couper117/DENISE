/**
 * Product configuration catalogue — the configurator's model of what a customer
 * can choose, and what it costs.
 *
 * ⚠️  KEEP IN SYNC WITH `backend/src/utils/productOptions.ts`.
 * That file is the authority: the server re-prices every line from the product
 * row when the order is placed, so anything here is an *estimate shown to the
 * customer*. Keeping the two identical is what makes the estimate match the
 * receipt. (`DELIVERY_FEES` is duplicated across the two sides the same way.)
 *
 * ── Why options carry no price ────────────────────────────────────────────────
 * Header type, lining and panel layout do change what a curtain costs, but the
 * shop has never recorded those surcharges anywhere. Inventing them would
 * overcharge real customers, so every `priceDelta` is 0 and the total comes from
 * the product's own price / salePrice / pricePerMeter. Set real numbers here and
 * in the backend mirror when the shop decides on them; nothing else changes.
 */
import { Product } from '../types';

export type ProductKind = 'CURTAIN' | 'FABRIC' | 'SIMPLE';
export type PricingMode = 'PER_METER' | 'PER_UNIT' | 'ON_REQUEST';

export interface OptionChoice {
  value: string;
  label: string;
  /** i18n key; falls back to `label` when the locale has no translation. */
  labelKey: string;
  description?: string;
  priceDelta: number;
}

const choice = (value: string, label: string, labelKey: string, description?: string): OptionChoice => ({
  value, label, labelKey, description, priceDelta: 0,
});

export const HEADER_TYPES: OptionChoice[] = [
  choice('ROD_POCKET', 'Rod pocket', 'config.header.ROD_POCKET', 'Fabric sleeve — the rod slides through'),
  choice('EYELET', 'Eyelet / grommet', 'config.header.EYELET', 'Metal rings, even modern folds'),
  choice('PENCIL_PLEAT', 'Pencil pleat', 'config.header.PENCIL_PLEAT', 'Gathered tape, classic look'),
  choice('PINCH_PLEAT', 'Pinch pleat', 'config.header.PINCH_PLEAT', 'Hand-finished tailored pleats'),
  choice('TAB_TOP', 'Tab top', 'config.header.TAB_TOP', 'Fabric loops over the rod'),
];

export const LINING_TYPES: OptionChoice[] = [
  choice('NONE', 'Unlined', 'config.lining.NONE', 'Lightest, lets light through'),
  choice('STANDARD', 'Standard lining', 'config.lining.STANDARD', 'Better drape, protects the fabric'),
  choice('BLACKOUT', 'Blackout lining', 'config.lining.BLACKOUT', 'Blocks light — bedrooms'),
  choice('THERMAL', 'Thermal lining', 'config.lining.THERMAL', 'Insulates against heat and cold'),
];

export const PANEL_LAYOUTS: OptionChoice[] = [
  choice('SINGLE', 'Single panel', 'config.panels.SINGLE', 'One curtain, draws to one side'),
  choice('PAIR', 'Pair (left + right)', 'config.panels.PAIR', 'Two curtains meeting in the middle'),
];

export const FULLNESS_CHOICES: OptionChoice[] = [
  choice('1.5', '1.5× — light gather', 'config.fullness.1_5'),
  choice('2', '2× — standard', 'config.fullness.2'),
  choice('2.5', '2.5× — full', 'config.fullness.2_5'),
  choice('3', '3× — luxurious', 'config.fullness.3'),
];

/** Top and bottom hem allowance added to the drop, in metres. */
export const HEM_ALLOWANCE_M = 0.3;

export const MAX_DIMENSION_CM = 2000;
export const MAX_METERS = 1000;
export const MAX_QUANTITY = 500;

const CURTAIN_HINTS = ['curtain', 'rideau', 'drape', 'sheer', 'blind'];

/**
 * Which configuration a product gets, derived from data that already exists —
 * its category and how it is priced — because the catalogue has no product-type
 * column and adding one would mean re-tagging every product.
 */
export const detectKind = (product: Product): ProductKind => {
  const haystack = `${product.category?.slug ?? ''} ${product.category?.name ?? ''} ${product.name}`.toLowerCase();
  if (CURTAIN_HINTS.some((hint) => haystack.includes(hint))) return 'CURTAIN';
  if (product.pricePerMeter != null) return 'FABRIC';
  return 'SIMPLE';
};

export const pricingMode = (product: Product): PricingMode => {
  if (product.pricePerMeter != null) return 'PER_METER';
  if (product.salePrice != null || product.price != null) return 'PER_UNIT';
  return 'ON_REQUEST';
};

/**
 * Running metres for one made-to-measure curtain set.
 *
 * `width × fullness` is the flat fabric width the finished curtain gathers
 * from; `drop + hem` is the cut length. Panel count deliberately does not
 * multiply — splitting the same gathered width into two panels does not need
 * twice the fabric.
 */
export const computeCurtainMeters = (widthCm: number, dropCm: number, fullness: number): number => {
  if (!(widthCm > 0) || !(dropCm > 0)) return 0;
  const meters = (widthCm / 100) * fullness * (dropCm / 100 + HEM_ALLOWANCE_M);
  return Math.min(MAX_METERS, Math.ceil(meters * 10) / 10);
};

/** What the configurator collects. Every field is optional — see `validate`. */
export interface Configuration {
  color?: string;
  widthCm?: number;
  dropCm?: number;
  meters?: number;
  headerType?: string;
  lining?: string;
  panelLayout?: string;
  fullness?: number;
  notes?: string;
}

export interface PricedConfiguration {
  meters: number | null;
  /** One configured unit. Null when the product has no price yet. */
  unitPrice: number | null;
  lineTotal: number | null;
  /** Same line at list price; the gap is the saving. */
  listTotal: number | null;
  unitLabel: string | null;
}

/** The fields a given product actually asks for. */
export const fieldsFor = (product: Product) => {
  const kind = detectKind(product);
  const mode = pricingMode(product);
  return {
    kind,
    mode,
    color: (product.colors?.length ?? 0) > 0,
    dimensions: kind === 'CURTAIN',
    meters: mode === 'PER_METER' && kind !== 'CURTAIN',
    curtainMakeUp: kind === 'CURTAIN',
  };
};

export const defaultConfiguration = (product: Product): Configuration => {
  const fields = fieldsFor(product);
  return {
    color: product.colors?.length === 1 ? product.colors[0].name : undefined,
    ...(fields.curtainMakeUp
      ? { headerType: 'EYELET', lining: 'NONE', panelLayout: 'PAIR', fullness: 2 }
      : {}),
  };
};

export const priceConfiguration = (
  product: Product,
  config: Configuration,
  quantity: number
): PricedConfiguration => {
  const fields = fieldsFor(product);
  const qty = Math.max(1, Math.min(MAX_QUANTITY, Math.floor(quantity) || 1));

  let meters: number | null = null;
  if (fields.mode === 'PER_METER') {
    meters = fields.kind === 'CURTAIN'
      ? (config.widthCm && config.dropCm
          ? computeCurtainMeters(config.widthCm, config.dropCm, config.fullness ?? 2)
          : null)
      : config.meters ?? null;
  }

  let unitPrice: number | null = null;
  let listUnitPrice: number | null = null;
  let unitLabel: string | null = null;

  if (fields.mode === 'PER_METER' && meters) {
    unitPrice = product.pricePerMeter! * meters;
    listUnitPrice = unitPrice;
    unitLabel = `${meters} m × ${product.pricePerMeter!.toLocaleString()} RWF/m`;
  } else if (fields.mode === 'PER_UNIT') {
    const sale = product.salePrice ?? product.price!;
    unitPrice = sale;
    listUnitPrice = product.price ?? sale;
  }

  return {
    meters,
    unitPrice: unitPrice != null ? Math.round(unitPrice) : null,
    lineTotal: unitPrice != null ? Math.round(unitPrice * qty) : null,
    listTotal: listUnitPrice != null ? Math.round(listUnitPrice * qty) : null,
    unitLabel,
  };
};

export type ConfigurationErrors = Partial<Record<keyof Configuration, string>>;

/**
 * Blocking problems only. A product with no price is *not* an error — the shop
 * quotes those after confirming, and the order flow supports it.
 */
export const validate = (product: Product, config: Configuration): ConfigurationErrors => {
  const fields = fieldsFor(product);
  const errors: ConfigurationErrors = {};

  if (fields.color && !config.color) errors.color = 'Choose a colour';

  if (fields.dimensions) {
    if (!config.widthCm) errors.widthCm = 'Enter the width in cm';
    else if (config.widthCm <= 0 || config.widthCm > MAX_DIMENSION_CM) errors.widthCm = `Width must be between 1 and ${MAX_DIMENSION_CM} cm`;
    if (!config.dropCm) errors.dropCm = 'Enter the length in cm';
    else if (config.dropCm <= 0 || config.dropCm > MAX_DIMENSION_CM) errors.dropCm = `Length must be between 1 and ${MAX_DIMENSION_CM} cm`;
  }

  if (fields.meters) {
    if (!config.meters) errors.meters = 'Enter how many meters you need';
    else if (config.meters <= 0 || config.meters > MAX_METERS) errors.meters = `Meters must be between 0.1 and ${MAX_METERS}`;
  }

  if (fields.curtainMakeUp) {
    if (!config.headerType) errors.headerType = 'Choose a header type';
    if (!config.panelLayout) errors.panelLayout = 'Choose single or pair';
  }

  return errors;
};

const labelOf = (list: OptionChoice[], value?: string) => list.find((c) => c.value === value)?.label;

/** Spec chips for the cart, review and invoice — the order the shop reads them in. */
export const describeConfiguration = (config: Configuration): { label: string; value: string }[] => {
  const out: { label: string; value: string }[] = [];
  if (config.color) out.push({ label: 'Colour', value: config.color });
  if (config.widthCm) out.push({ label: 'Width', value: `${config.widthCm} cm` });
  if (config.dropCm) out.push({ label: 'Length', value: `${config.dropCm} cm` });
  if (config.meters) out.push({ label: 'Fabric', value: `${config.meters} m` });
  if (config.fullness) out.push({ label: 'Fullness', value: `${config.fullness}×` });
  const header = labelOf(HEADER_TYPES, config.headerType);
  if (header) out.push({ label: 'Header', value: header });
  const lining = labelOf(LINING_TYPES, config.lining);
  if (lining) out.push({ label: 'Lining', value: lining });
  const panels = labelOf(PANEL_LAYOUTS, config.panelLayout);
  if (panels) out.push({ label: 'Panels', value: panels });
  return out;
};

/**
 * Two lines are the same line when they are the same product configured the
 * same way — adding an identical curtain twice should bump the quantity, not
 * grow the cart.
 */
export const configurationKey = (productId: string, config: Configuration): string =>
  [
    productId,
    config.color ?? '',
    config.widthCm ?? '',
    config.dropCm ?? '',
    config.meters ?? '',
    config.headerType ?? '',
    config.lining ?? '',
    config.panelLayout ?? '',
    config.fullness ?? '',
    (config.notes ?? '').trim().toLowerCase(),
  ].join('|');
