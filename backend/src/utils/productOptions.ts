/**
 * Product configuration catalogue and line pricing.
 *
 * ⚠️  KEEP IN SYNC WITH `frontend/src/lib/productOptions.ts`.
 * The two files describe the same catalogue in two languages: the frontend one
 * drives the configurator UI and shows the customer an estimate, this one is
 * the authority. A divergence shows up as a total that changes between the
 * review step and the order — never as an overcharge, because the server
 * always re-prices from the product row. (`DELIVERY_FEES` in `utils/delivery.ts`
 * is duplicated the same way.)
 *
 * ── Why prices are not attached to options ────────────────────────────────────
 * Header type, lining and panel layout genuinely change what a curtain costs,
 * but the shop has never recorded those surcharges anywhere — not on Product,
 * not in the seed. Inventing numbers would silently overcharge real customers,
 * so every `priceDelta` below is 0: the total is driven purely by the product's
 * own `price` / `salePrice` / `pricePerMeter`, and the options ride along as
 * recorded specification. When the shop decides on real surcharges, set them
 * here (and in the frontend mirror) — nothing else has to change.
 */

export type ProductKind = 'CURTAIN' | 'ROD' | 'ATTIRE' | 'FABRIC' | 'SIMPLE';
/** Night curtain (heavy, "rideau de nuit") or day curtain (sheer, "rideau du jour"). */
export type CurtainRole = 'HARD' | 'SOFT';
/** Which part of a window set a line is. */
export type SetRole = 'HARD' | 'SOFT' | 'ROD';
export type PricingMode = 'PER_METER' | 'PER_UNIT' | 'ON_REQUEST';

export interface OptionChoice {
  value: string;
  label: string;
  /** RWF added to the unit price when chosen. See the note above: all 0 today. */
  priceDelta: number;
}

const choice = (value: string, label: string, priceDelta = 0): OptionChoice => ({ value, label, priceDelta });

export const HEADER_TYPES: OptionChoice[] = [
  choice('ROD_POCKET', 'Rod pocket'),
  choice('EYELET', 'Eyelet / grommet'),
  choice('PENCIL_PLEAT', 'Pencil pleat'),
  choice('PINCH_PLEAT', 'Pinch pleat'),
  choice('TAB_TOP', 'Tab top'),
];

export const LINING_TYPES: OptionChoice[] = [
  choice('NONE', 'Unlined'),
  choice('STANDARD', 'Standard lining'),
  choice('BLACKOUT', 'Blackout lining'),
  choice('THERMAL', 'Thermal lining'),
];

export const PANEL_LAYOUTS: OptionChoice[] = [
  choice('SINGLE', 'Single panel'),
  choice('PAIR', 'Pair (left + right)'),
];

export const FULLNESS_CHOICES: OptionChoice[] = [
  choice('1.5', '1.5× — light gather'),
  choice('2', '2× — standard'),
  choice('2.5', '2.5× — full'),
  choice('3', '3× — luxurious'),
];

/** Top and bottom hem allowance added to the drop, in metres. */
export const HEM_ALLOWANCE_M = 0.3;

/** Bounds mirrored by the request validator; also guard the maths below. */
export const MAX_DIMENSION_CM = 2000;
export const MAX_METERS = 1000;
export const MAX_QUANTITY = 500;

type ProductLike = {
  id: string;
  name: string;
  price: number | null;
  salePrice: number | null;
  pricePerMeter: number | null;
  material: string | null;
  category?: { name?: string | null; slug?: string | null } | null;
  colors?: { name: string }[];
};

const CURTAIN_HINTS = ['curtain', 'rideau', 'rido', 'drape', 'sheer', 'blind', 'voile'];
/** Checked before the curtain hints: "curtain-rods" contains "curtain". */
const ROD_HINTS = ['rod', 'tringle', 'rail', 'track'];
/** A curtain is a day curtain when any of these appear; otherwise night. */
const SOFT_HINTS = ['soft', 'sheer', 'voile', 'jour', 'day', 'tulle', 'lace'];

/** How far a rod runs past the window on each side, so a drawn curtain clears the glass. */
export const ROD_OVERHANG_CM = 15;

/** Traditional attire is cut by the metre; one standard outfit takes this much. */
export const STANDARD_ATTIRE_METERS = 4;
const ATTIRE_HINTS = ['traditional', 'attire', 'gakondo', 'umushanana', 'mushanana', 'imikenyero', 'mukenyero'];

/**
 * How the night and day curtains share one window or door. `hard` / `soft`
 * are the share of the opening's width each curtain covers — the metres are
 * worked out from that share — and `rod` says whether both hang on one track
 * or need a double rod. The shares are the shop's rule of thumb; change them
 * here and in the frontend mirror.
 */
export const ARRANGEMENTS = {
  NIGHT_ONLY: { label: 'Night curtain only', hard: 1, soft: 0, rod: 'SINGLE', hardPanels: 'PAIR', softPanels: null },
  DAY_ONLY: { label: 'Day curtain only', hard: 0, soft: 1, rod: 'SINGLE', hardPanels: null, softPanels: 'PAIR' },
  LAYERED: { label: 'Day curtain behind, night curtain in front', hard: 1, soft: 1, rod: 'DOUBLE', hardPanels: 'PAIR', softPanels: 'PAIR' },
  DAY_CENTER: { label: 'Night curtains at the sides, day curtain in the middle', hard: 0.5, soft: 0.5, rod: 'SINGLE', hardPanels: 'PAIR', softPanels: 'SINGLE' },
  NIGHT_CENTER: { label: 'Day curtains at the sides, night curtain in the middle', hard: 0.5, soft: 0.5, rod: 'SINGLE', hardPanels: 'SINGLE', softPanels: 'PAIR' },
  SIDE_BY_SIDE: { label: 'Night and day curtain side by side', hard: 0.5, soft: 0.5, rod: 'SINGLE', hardPanels: 'SINGLE', softPanels: 'SINGLE' },
} as const;
export type Arrangement = keyof typeof ARRANGEMENTS;

export const isArrangement = (value: unknown): value is Arrangement =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(ARRANGEMENTS, value);

/** Share of the opening's width a curtain of this role covers (1 when no arrangement was chosen). */
export const arrangementShare = (arrangement: unknown, role: CurtainRole): number => {
  if (!isArrangement(arrangement)) return 1;
  const share = role === 'HARD' ? ARRANGEMENTS[arrangement].hard : ARRANGEMENTS[arrangement].soft;
  return share > 0 ? share : 1;
};

const haystackOf = (product: ProductLike) =>
  `${product.category?.slug ?? ''} ${product.category?.name ?? ''} ${product.name}`.toLowerCase();

const hasHint = (text: string, hints: string[]) =>
  hints.some((hint) => new RegExp(`(^|[^a-z])${hint}`).test(text));

/**
 * Which configuration a product gets. Derived from data that already exists —
 * the category it sits in and how it is priced — because the catalogue has no
 * product-type column and adding one would mean re-tagging every product.
 */
export const detectKind = (product: ProductLike): ProductKind => {
  const haystack = haystackOf(product);
  if (hasHint(haystack, ROD_HINTS)) return 'ROD';
  if (CURTAIN_HINTS.some((hint) => haystack.includes(hint))) return 'CURTAIN';
  if (product.pricePerMeter != null && hasHint(haystack, ATTIRE_HINTS)) return 'ATTIRE';
  if (product.pricePerMeter != null) return 'FABRIC';
  return 'SIMPLE';
};

/** Only meaningful for a CURTAIN. Unmarked curtains are night curtains. */
export const curtainRole = (product: ProductLike): CurtainRole =>
  hasHint(haystackOf(product), SOFT_HINTS) ? 'SOFT' : 'HARD';

/** Rod length for a window: the width plus the overhang both sides, rounded up to 10 cm. */
export const computeRodLengthCm = (windowWidthCm: number): number => {
  if (!(windowWidthCm > 0)) return 0;
  return Math.min(MAX_DIMENSION_CM, Math.ceil((windowWidthCm + 2 * ROD_OVERHANG_CM) / 10) * 10);
};

export const pricingMode = (product: ProductLike): PricingMode => {
  if (product.pricePerMeter != null) return 'PER_METER';
  if (product.salePrice != null || product.price != null) return 'PER_UNIT';
  return 'ON_REQUEST';
};

/**
 * Running metres of fabric for one made-to-measure curtain set.
 *
 * `width × fullness` is the flat fabric width the finished curtain gathers from;
 * `drop + hem` is the cut length. Panel count deliberately does NOT multiply —
 * splitting the same gathered width into two panels does not need twice the
 * fabric. (The older FabricEstimator multiplied by panels, which over-estimated
 * a pair by 2×.)
 */
export const computeCurtainMeters = (widthCm: number, dropCm: number, fullness: number): number => {
  if (!(widthCm > 0) || !(dropCm > 0)) return 0;
  const meters = (widthCm / 100) * fullness * (dropCm / 100 + HEM_ALLOWANCE_M);
  // Fabric is cut to a tenth of a metre; always round up so a line is never
  // short of what the workshop has to cut.
  return Math.min(MAX_METERS, Math.ceil(meters * 10) / 10);
};

const findChoice = (list: OptionChoice[], value: unknown): OptionChoice | null =>
  typeof value === 'string' ? list.find((c) => c.value === value) ?? null : null;

const clampNumber = (value: unknown, max: number): number | null => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(n, max);
};

export interface RawItemInput {
  productId: string;
  quantity?: number | null;
  metersRequired?: number | null;
  windowWidth?: number | null;
  windowHeight?: number | null;
  totalPrice?: number | null;
  notes?: string | null;
  options?: Record<string, unknown> | null;
}

/** What is persisted to `ReservationItem.options`. */
export interface NormalizedOptions {
  kind: ProductKind;
  pricingMode: PricingMode;
  productName: string;
  /** Night or day curtain. */
  curtainRole?: CurtainRole;
  /** Lines bought together for one window share a set id. */
  setId?: string;
  setRole?: SetRole;
  /** Rod length for the window, in cm. */
  rodLengthCm?: number;
  /** How night and day curtains are arranged on the opening. */
  arrangement?: Arrangement;
  arrangementLabel?: string;
  /** Which window or door this line is for, e.g. "Window 2" / "Door 1". */
  openingLabel?: string;
  color?: string;
  fabric?: string;
  headerType?: string;
  headerTypeLabel?: string;
  lining?: string;
  liningLabel?: string;
  panelLayout?: string;
  panelLayoutLabel?: string;
  fullness?: number;
  widthCm?: number;
  dropCm?: number;
  meters?: number;
  unitLabel?: string;
}

export interface PricedLine {
  quantity: number;
  meters: number | null;
  widthCm: number | null;
  dropCm: number | null;
  /** Price of one configured unit, at the price actually charged. */
  unitPrice: number | null;
  /** unitPrice × quantity, rounded to whole RWF. */
  lineTotal: number;
  /** Same line at list price — the difference is the customer's saving. */
  listTotal: number;
  options: NormalizedOptions;
}

/**
 * Price one cart line from the product row. Client-sent money is ignored
 * entirely; only the *configuration* is taken from the request, and every
 * option is matched against the catalogue above before it is stored, so an
 * arbitrary JSON blob can never reach the admin screen or an invoice.
 */
export const priceLine = (product: ProductLike, item: RawItemInput): PricedLine => {
  const kind = detectKind(product);
  const mode = pricingMode(product);
  const raw = (item.options && typeof item.options === 'object' ? item.options : {}) as Record<string, unknown>;

  const quantity = Math.max(1, Math.min(MAX_QUANTITY, Math.floor(clampNumber(item.quantity, MAX_QUANTITY) ?? 1)));

  const options: NormalizedOptions = { kind, pricingMode: mode, productName: product.name };
  if (kind === 'CURTAIN') options.curtainRole = curtainRole(product);

  // Window-set grouping. Only a short slug is accepted, and the role must match
  // what the product actually is, so the admin screen can trust both.
  if (typeof raw.setId === 'string' && /^[a-z0-9-]{4,40}$/.test(raw.setId)) {
    const expectedRole: SetRole | null = kind === 'ROD' ? 'ROD' : kind === 'CURTAIN' ? curtainRole(product) : null;
    if (expectedRole) {
      options.setId = raw.setId;
      options.setRole = expectedRole;
    }
  }

  // Colour must be one the product actually offers.
  const colorName = typeof raw.color === 'string' ? raw.color.trim() : '';
  if (colorName && product.colors?.some((c) => c.name === colorName)) options.color = colorName;

  if (product.material) options.fabric = product.material;

  let optionDelta = 0;
  if (kind === 'CURTAIN') {
    const header = findChoice(HEADER_TYPES, raw.headerType);
    if (header) {
      options.headerType = header.value;
      options.headerTypeLabel = header.label;
      optionDelta += header.priceDelta;
    }
    const lining = findChoice(LINING_TYPES, raw.lining);
    if (lining) {
      options.lining = lining.value;
      options.liningLabel = lining.label;
      optionDelta += lining.priceDelta;
    }
    const layout = findChoice(PANEL_LAYOUTS, raw.panelLayout);
    if (layout) {
      options.panelLayout = layout.value;
      options.panelLayoutLabel = layout.label;
      optionDelta += layout.priceDelta;
    }
  }

  const widthCm = clampNumber(item.windowWidth ?? raw.widthCm, MAX_DIMENSION_CM);
  const dropCm = clampNumber(item.windowHeight ?? raw.dropCm, MAX_DIMENSION_CM);
  if (widthCm) options.widthCm = widthCm;
  if (dropCm) options.dropCm = dropCm;

  const fullnessChoice = findChoice(FULLNESS_CHOICES, raw.fullness != null ? String(raw.fullness) : undefined);
  const fullness = fullnessChoice ? Number(fullnessChoice.value) : 2;
  if (kind === 'CURTAIN') options.fullness = fullness;

  if ((kind === 'CURTAIN' || kind === 'ROD') && isArrangement(raw.arrangement)) {
    options.arrangement = raw.arrangement;
    options.arrangementLabel = ARRANGEMENTS[raw.arrangement].label;
  }
  // Free text from the customer, so only a short, plain label is kept.
  if (typeof raw.openingLabel === 'string') {
    const label = raw.openingLabel.trim().replace(/\s+/g, ' ');
    if (label && label.length <= 40 && /^[\p{L}\p{N} .#'’-]+$/u.test(label)) options.openingLabel = label;
  }

  // ── Metres ────────────────────────────────────────────────────────────────
  // For a made-to-measure curtain the metres are *derived* from the dimensions,
  // never taken from the client. Everything else uses the metres the customer
  // asked for (cut-to-length fabric).
  // A rod's length is derived from the window width the same way, so a rod
  // sold by the metre is priced for the window it was measured against.
  if (kind === 'ROD' && widthCm) options.rodLengthCm = computeRodLengthCm(widthCm);

  let meters: number | null = null;
  if (mode === 'PER_METER') {
    // The curtain covers only its share of the opening in split arrangements.
    if (kind === 'CURTAIN' && widthCm && dropCm) {
      meters = computeCurtainMeters(widthCm * arrangementShare(raw.arrangement, curtainRole(product)), dropCm, fullness);
    }
    else if (kind === 'ROD' && options.rodLengthCm) meters = options.rodLengthCm / 100;
    else meters = clampNumber(item.metersRequired, MAX_METERS);
    if (meters) options.meters = meters;
  }

  // ── Money ─────────────────────────────────────────────────────────────────
  let unitPrice: number | null = null;
  let listUnitPrice: number | null = null;
  if (mode === 'PER_METER' && meters) {
    unitPrice = product.pricePerMeter! * meters + optionDelta;
    listUnitPrice = unitPrice;
    options.unitLabel = `${meters} m × ${product.pricePerMeter!.toLocaleString('en-RW')} RWF/m`;
  } else if (mode === 'PER_UNIT') {
    const sale = product.salePrice ?? product.price!;
    unitPrice = sale + optionDelta;
    listUnitPrice = (product.price ?? sale) + optionDelta;
  }

  const lineTotal = unitPrice != null ? Math.round(unitPrice * quantity) : 0;
  const listTotal = listUnitPrice != null ? Math.round(listUnitPrice * quantity) : lineTotal;

  return {
    quantity,
    meters,
    widthCm,
    dropCm,
    unitPrice: unitPrice != null ? Math.round(unitPrice) : null,
    lineTotal,
    listTotal,
    options,
  };
};

/** Human-readable one-line spec, used by notifications and the invoice. */
export const describeOptions = (options: NormalizedOptions | null | undefined): string => {
  if (!options) return '';
  const parts: string[] = [];
  if (options.openingLabel) parts.push(options.openingLabel);
  if (options.arrangementLabel) parts.push(options.arrangementLabel);
  if (options.curtainRole) parts.push(options.curtainRole === 'SOFT' ? 'Day curtain (rideau du jour)' : 'Night curtain (rideau de nuit)');
  if (options.color) parts.push(options.color);
  if (options.kind === 'ROD' && options.rodLengthCm) parts.push(`Rod ${options.rodLengthCm / 100} m`);
  else if (options.widthCm && options.dropCm) parts.push(`${options.widthCm} × ${options.dropCm} cm`);
  if (options.meters && options.kind !== 'ROD') parts.push(`${options.meters} m`);
  if (options.headerTypeLabel) parts.push(options.headerTypeLabel);
  if (options.liningLabel) parts.push(options.liningLabel);
  if (options.panelLayoutLabel) parts.push(options.panelLayoutLabel);
  return parts.join(' · ');
};
