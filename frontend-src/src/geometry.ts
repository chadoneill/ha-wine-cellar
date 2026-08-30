/* Physical bottle geometry: what a bottle actually measures, and how a row of
   them actually packs.
 *
 * Everything here is opt-in. A cabinet with no `internal_width_mm` renders
 * exactly as it always has -- a uniform grid of equal cells -- and nothing in
 * this file runs. Set the cabinet's real internal width and the same row is
 * laid out to scale instead, each bottle at its true base width.
 *
 * Two rules make a scale drawing honest, and both are easy to get wrong:
 *
 *   1. AN EMPTY POSITION CONTRIBUTES ZERO WIDTH. Model it at the nominal pitch
 *      and it becomes the fattest object in the row -- 86 mm against a
 *      Bordeaux's 76 -- so a sparse cabinet draws its empty slots larger than
 *      its wine. The empty ring is drawn at a fixed reference diameter on the
 *      leftover pitch instead.
 *
 *   2. AN OVER-CAPACITY ROW MUST VISIBLY OVERFLOW. Normalising it back to the
 *      shelf width makes five Champagnes in a 430 mm shelf render identically
 *      to an empty shelf, which is the one case the drawing exists to shout
 *      about. The scale is therefore always 100/span, never
 *      100/max(span, wanted).
 */

export const BOTTLE_SHAPES = [
  "bordeaux",
  "bordeaux_heavy",
  "burgundy",
  "champagne",
  "flute",
  "port",
] as const;

export type BottleShape = (typeof BOTTLE_SHAPES)[number];

export interface ShapeSpec {
  name: string;
  base_width_mm: number;
  length_mm: number;
}

/* `bordeaux_heavy` exists because premium heavy glass -- Grange, Hill of
   Grace, Unico, Sassicaia, most serious Barossa Shiraz -- runs 82-88 mm, not
   the nominal 76. Nine millimetres a bottle is the difference between a row
   that looks crowded and one that looks roomy, which is the whole reason a
   drawing to scale is worth having.
 *
 * `port` is 305 mm, not the 265 often quoted -- 265 is a 500 ml fortified, not
 * a 750 ml port, and the difference matters on a shelf where clearance is
 * tight. */
export const SHAPES: Record<BottleShape, ShapeSpec> = {
  bordeaux: { name: "Bordeaux", base_width_mm: 76, length_mm: 305 },
  bordeaux_heavy: { name: "Bordeaux, heavy", base_width_mm: 85, length_mm: 320 },
  burgundy: { name: "Burgundy", base_width_mm: 84, length_mm: 300 },
  champagne: { name: "Champagne", base_width_mm: 90, length_mm: 315 },
  flute: { name: "Alsace flute", base_width_mm: 72, length_mm: 345 },
  port: { name: "Port / fortified", base_width_mm: 78, length_mm: 305 },
};

export const BOTTLE_FORMATS = [375, 500, 750, 1500, 3000] as const;
export type BottleFormat = (typeof BOTTLE_FORMATS)[number];

export interface FormatSpec {
  name: string;
  short: string | null;
  width: number;
  length: number;
}

/* Format multiplies both dimensions, by DIFFERENT amounts. A Bordeaux magnum
   therefore computes to 102 mm wide and 378 mm long -- transposing the two is
   the easy mistake and produces a bottle too narrow and too tall. */
export const FORMATS: Record<BottleFormat, FormatSpec> = {
  375: { name: "375 ml (half)", short: "HALF", width: 0.82, length: 0.82 },
  500: { name: "500 ml", short: "500", width: 0.88, length: 0.87 },
  750: { name: "750 ml", short: null, width: 1.0, length: 1.0 },
  1500: { name: "1.5 L (magnum)", short: "MAG", width: 1.34, length: 1.24 },
  3000: { name: "3 L (double magnum)", short: "DBL", width: 1.6, length: 1.45 },
};

export const DEFAULT_SHAPE: BottleShape = "bordeaux";
export const DEFAULT_FORMAT: BottleFormat = 750;

/* The drawn diameter of an empty ring, in millimetres of the row's own scale.
   A fixed reference, deliberately NOT part of any width sum. */
export const EMPTY_REFERENCE_MM = SHAPES.bordeaux.base_width_mm; // 76

/* Two tangent circles whose centres are one radius apart overlap vertically by
   this fraction of a diameter. 1 - sqrt(3)/2 = 0.13397... */
export const STACK_OVERLAP_FRACTION = 1 - Math.sqrt(3) / 2;

export interface Dims {
  base_width_mm: number;
  length_mm: number;
  /* true when either figure came off a caliper rather than the table */
  measured: boolean;
  shape: ShapeSpec;
}

export function normaliseShape(value: unknown): BottleShape {
  return (BOTTLE_SHAPES as readonly string[]).includes(value as string)
    ? (value as BottleShape)
    : DEFAULT_SHAPE;
}

export function normaliseFormat(value: unknown): BottleFormat {
  const n = typeof value === "string" ? parseInt(value, 10) : (value as number);
  return (BOTTLE_FORMATS as readonly number[]).includes(n) ? (n as BottleFormat) : DEFAULT_FORMAT;
}

export function nominalDims(shape: BottleShape, format: BottleFormat) {
  const s = SHAPES[shape] ?? SHAPES[DEFAULT_SHAPE];
  const f = FORMATS[format] ?? FORMATS[DEFAULT_FORMAT];
  return {
    base_width_mm: Math.round(s.base_width_mm * f.width),
    length_mm: Math.round(s.length_mm * f.length),
  };
}

/* What a bottle measures. A value actually taken off the bottle with a caliper
   always beats the table. */
export function bottleDims(bottle: {
  shape?: string | null;
  format_ml?: number | string | null;
  base_width_mm?: number | null;
  length_mm?: number | null;
}): Dims {
  const shape = normaliseShape(bottle.shape);
  const format = normaliseFormat(bottle.format_ml);
  const nominal = nominalDims(shape, format);
  const measuredWidth = typeof bottle.base_width_mm === "number" && bottle.base_width_mm > 0;
  const measuredLength = typeof bottle.length_mm === "number" && bottle.length_mm > 0;
  return {
    base_width_mm: measuredWidth ? bottle.base_width_mm! : nominal.base_width_mm,
    length_mm: measuredLength ? bottle.length_mm! : nominal.length_mm,
    measured: measuredWidth || measuredLength,
    shape: SHAPES[shape],
  };
}

export function formatLabel(format: number | string | null | undefined): string | null {
  return FORMATS[normaliseFormat(format)]?.short ?? null;
}

/* ------------------------------------------------------------ row layout */

export interface RowItem<T> {
  /* the column index this item sits at */
  index: number;
  occupant: T | null;
  /* the real base width in mm, or 0 for an empty position -- never the pitch */
  mm: number;
  /* percentages of the row's span. widthPct is 0 for an empty position. */
  widthPct: number;
  leftPct: number;
  centrePct: number;
  /* what to draw where there is no bottle: a fixed reference ring */
  emptyRefPct: number;
}

export interface RowLayout<T> {
  span_mm: number;
  /* the sum of real bottle widths. Empty positions add nothing. */
  occupied_mm: number;
  /* true when the wine in this row is wider than the row is. A boolean, not a
     margin: the drawing shows the overflow, and how many millimetres are spare
     is not something to tell somebody about their own shelf. */
  overflow: boolean;
  /* percent per millimetre. Always 100 / span, so overflow overflows. */
  scale: number;
  gapPct: number;
  items: RowItem<T>[];
}

/* Lay out one row of `count` positions across `span_mm` of real shelf.
 *
 * Air is spread evenly across the count + 1 boundaries: before the first
 * position, between each pair, and after the last. An empty position then sits
 * between two gaps and reads as visibly more air than a gap, and an all-empty
 * row still lays its rings out evenly across the span. */
export function layoutRow<T>(
  count: number,
  span_mm: number,
  occupantAt: (index: number) => T | null,
  widthOf: (occupant: T) => number,
): RowLayout<T> {
  const span = span_mm > 0 ? span_mm : 1;
  const scale = 100 / span;

  const found: { index: number; occupant: T | null; mm: number }[] = [];
  for (let index = 0; index < count; index++) {
    const occupant = occupantAt(index);
    /* An empty position contributes ZERO. This line is rule 1. */
    found.push({ index, occupant, mm: occupant ? widthOf(occupant) : 0 });
  }

  const occupied = found.reduce((m, i) => m + i.mm, 0);
  /* Leftover span, used only to space the row out. It is never reported. */
  const gapMm = count > 0 ? Math.max(0, span - occupied) / (count + 1) : 0;
  const gapPct = gapMm * scale;

  const items: RowItem<T>[] = [];
  let x = 0;
  for (const f of found) {
    x += gapPct;
    const widthPct = f.mm * scale;
    items.push({
      index: f.index,
      occupant: f.occupant,
      mm: f.mm,
      widthPct,
      leftPct: x,
      centrePct: x + widthPct / 2,
      emptyRefPct: EMPTY_REFERENCE_MM * scale,
    });
    x += widthPct;
  }

  return {
    span_mm: span,
    occupied_mm: occupied,
    /* Rule 2: the scale is the row's own, so too much wine runs past 100%. */
    overflow: occupied > span,
    scale,
    gapPct,
    items,
  };
}

/* A stacked bottle sits at the TRUE valley -- the midpoint between the actual
   centres of the two beneath -- so a stack resting on mismatched widths sits
   off-centre, as it would in the cabinet. */
export function nestOverBase<T>(stack: RowLayout<T>, base: RowLayout<unknown>): RowLayout<T> {
  const items = stack.items.map((item, k) => {
    const left = base.items[k];
    const right = base.items[k + 1];
    if (!left || !right) return item;
    const valley = (left.centrePct + right.centrePct) / 2;
    return { ...item, centrePct: valley, leftPct: valley - item.widthPct / 2 };
  });
  return { ...stack, items };
}

/* How far the stack row overlaps the base row, as a percentage of the row's
   span. Uses the mean width of the wine actually beneath, falling back to the
   reference when the base row is empty -- an empty shelf still has to draw its
   stack row somewhere. */
export function stackOverlapPct(base: RowLayout<unknown>): number {
  const beneath = base.items.filter((i) => i.mm > 0);
  const meanMm = beneath.length
    ? beneath.reduce((m, i) => m + i.mm, 0) / beneath.length
    : EMPTY_REFERENCE_MM;
  return STACK_OVERLAP_FRACTION * meanMm * base.scale;
}

/* A stack row holds one fewer bottle than the row it nests into. */
export const stackCapacity = (baseCount: number): number => Math.max(0, baseCount - 1);
