import { describe, expect, it } from "vitest";

import {
  BOTTLE_FORMATS,
  BOTTLE_SHAPES,
  EMPTY_REFERENCE_MM,
  SHAPES,
  STACK_OVERLAP_FRACTION,
  bottleDims,
  layoutRow,
  nestOverBase,
  nominalDims,
  normaliseFormat,
  normaliseShape,
  stackCapacity,
  stackOverlapPct,
} from "../src/geometry";
import type { BottleFormat, BottleShape } from "../src/geometry";

/* Every shape x every format, pinned. These were computed by hand from the
   published bottle dimensions and cross-checked against the implementation --
   agreement on all thirty is the only reason a pinned table is worth having. */
const TABLE: Record<BottleShape, Record<BottleFormat, [width: number, length: number]>> = {
  bordeaux: { 375: [62, 250], 500: [67, 265], 750: [76, 305], 1500: [102, 378], 3000: [122, 442] },
  bordeaux_heavy: { 375: [70, 262], 500: [75, 278], 750: [85, 320], 1500: [114, 397], 3000: [136, 464] },
  burgundy: { 375: [69, 246], 500: [74, 261], 750: [84, 300], 1500: [113, 372], 3000: [134, 435] },
  champagne: { 375: [74, 258], 500: [79, 274], 750: [90, 315], 1500: [121, 391], 3000: [144, 457] },
  flute: { 375: [59, 283], 500: [63, 300], 750: [72, 345], 1500: [96, 428], 3000: [115, 500] },
  port: { 375: [64, 250], 500: [69, 265], 750: [78, 305], 1500: [105, 378], 3000: [125, 442] },
};

describe("bottle dimensions", () => {
  for (const shape of BOTTLE_SHAPES) {
    for (const format of BOTTLE_FORMATS) {
      const [width, length] = TABLE[shape][format];
      it(`${shape} at ${format} ml is ${width} x ${length} mm`, () => {
        expect(nominalDims(shape, format)).toEqual({ base_width_mm: width, length_mm: length });
      });
    }
  }

  /* Transposing these two is the easy mistake, and it produces a bottle that is
     too narrow and too tall. */
  it("a Bordeaux magnum is 102 mm wide and 378 mm long, not the transposition", () => {
    const d = nominalDims("bordeaux", 1500);
    expect(d.base_width_mm).toBe(102);
    expect(d.length_mm).toBe(378);
  });

  it("no bottle is ever wider than it is long", () => {
    for (const shape of BOTTLE_SHAPES) {
      for (const format of BOTTLE_FORMATS) {
        const d = nominalDims(shape, format);
        expect(d.base_width_mm, `${shape}/${format}`).toBeLessThan(d.length_mm);
      }
    }
  });

  /* The whole reason bordeaux_heavy exists: nine millimetres a bottle. */
  it("bordeaux_heavy is meaningfully wider than nominal", () => {
    expect(SHAPES.bordeaux_heavy.base_width_mm * 5).toBe(425);
    expect(SHAPES.bordeaux.base_width_mm * 5).toBe(380);
  });

  it("port is a 750 ml port, not a 500 ml fortified", () => {
    expect(SHAPES.port.length_mm).toBeGreaterThanOrEqual(300);
  });

  it("a measured value beats the table, per dimension", () => {
    const d = bottleDims({ shape: "bordeaux", format_ml: 750, base_width_mm: 88 });
    expect(d.base_width_mm).toBe(88);
    expect(d.length_mm).toBe(305);
    expect(d.measured).toBe(true);
  });

  /* Existing installs have no shape and no format on any wine. Everything must
     fall back to a nominal Bordeaux rather than throwing or drawing nothing. */
  it("falls back to a nominal Bordeaux for data that predates these fields", () => {
    expect(bottleDims({})).toMatchObject({ base_width_mm: 76, length_mm: 305, measured: false });
    expect(bottleDims({ shape: null, format_ml: null })).toMatchObject({ base_width_mm: 76 });
    expect(bottleDims({ shape: "nonsense", format_ml: 999 })).toMatchObject({ base_width_mm: 76 });
    expect(normaliseShape(undefined)).toBe("bordeaux");
    expect(normaliseFormat("1500")).toBe(1500);
  });
});

/* ---------------------------------------------------------------- layout */

type Bottle = { mm: number };
const row = (span: number, widths: (number | null)[]) =>
  layoutRow<Bottle>(
    widths.length,
    span,
    (i) => (widths[i] == null ? null : { mm: widths[i]! }),
    (b) => b.mm,
  );

const totalWidth = (l: ReturnType<typeof row>) => l.items.reduce((m, i) => m + i.widthPct, 0);

describe("a row drawn to scale", () => {
  /* Rule 1. Model an empty position at the nominal pitch and it becomes the
     fattest object in the row -- 86 mm against a Bordeaux's 76 -- so a sparse
     cabinet draws its empty slots larger than its wine. */
  it("an empty position contributes ZERO to the row width", () => {
    const l = row(430, [76, null, null, null, null]);
    expect(l.occupied_mm).toBe(76);
    const empties = l.items.filter((i) => i.occupant === null);
    expect(empties).toHaveLength(4);
    expect(empties.every((i) => i.widthPct === 0 && i.mm === 0)).toBe(true);
  });

  it("an empty ring never draws wider than the wine beside it", () => {
    const l = row(430, [76, null, null, null, null]);
    const wine = l.items.find((i) => i.occupant)!;
    for (const item of l.items) {
      if (item.occupant) continue;
      expect(item.emptyRefPct).toBeLessThanOrEqual(wine.widthPct);
    }
    expect(EMPTY_REFERENCE_MM).toBe(76);
  });

  it("an empty row lays its rings out evenly, not bunched", () => {
    const l = row(430, [null, null, null, null, null]);
    expect(l.occupied_mm).toBe(0);
    expect(totalWidth(l)).toBe(0);
    const centres = l.items.map((i) => i.centrePct);
    const gaps = centres.slice(1).map((c, i) => c - centres[i]!);
    for (const g of gaps) expect(g).toBeCloseTo(gaps[0]!, 6);
  });

  /* Rule 2. Normalising an over-capacity row back to the shelf width makes
     five Champagnes in a 430 mm shelf render identically to an empty shelf --
     the one case the drawing exists to shout about. */
  it("an over-capacity row visibly overflows", () => {
    const l = row(430, [90, 90, 90, 90, 90]);
    expect(l.occupied_mm).toBe(450);
    expect(l.overflow).toBe(true);
    expect(totalWidth(l)).toBeGreaterThan(100);
    expect(l.gapPct).toBe(0);
  });

  it("an over-capacity row does not render like an empty one", () => {
    const full = row(430, [90, 90, 90, 90, 90]);
    const empty = row(430, [null, null, null, null, null]);
    expect(totalWidth(full)).not.toBeCloseTo(totalWidth(empty), 6);
    /* both measured against the same ruler */
    expect(full.scale).toBe(empty.scale);
    expect(full.scale).toBeCloseTo(100 / 430, 9);
  });

  it("the scale never depends on what is in the row", () => {
    const scales = [
      row(430, [null, null, null, null, null]),
      row(430, [76, null, null, null, null]),
      row(430, [76, 76, 76, 76, 76]),
      row(430, [90, 90, 90, 90, 90]),
    ].map((l) => l.scale);
    expect(new Set(scales).size).toBe(1);
  });

  it("a row of heavy bottles is visibly tighter than a row of nominal ones", () => {
    const heavy = row(430, [85, 85, 85, 85, 85]);
    const light = row(430, [76, 76, 76, 76, 76]);
    expect(heavy.occupied_mm).toBe(425);
    expect(heavy.overflow).toBe(false);
    /* the difference shows up as air between the bottles, not as a number */
    expect(heavy.gapPct).toBeLessThan(light.gapPct);
  });

  it("a magnum visibly crowds its neighbours", () => {
    const l = row(430, [102, 76, 76, 76]);
    expect(l.items[0]!.widthPct).toBeGreaterThan(l.items[1]!.widthPct);
    expect(l.occupied_mm).toBe(330);
  });

  it("survives a cabinet with no width set without dividing by zero", () => {
    const l = row(0, [76, 76]);
    expect(Number.isFinite(l.scale)).toBe(true);
    expect(l.overflow).toBe(true);
  });
});

describe("the stack row", () => {
  it("nests at the exact figure for two tangent circles", () => {
    expect(STACK_OVERLAP_FRACTION).toBeCloseTo(1 - Math.sqrt(3) / 2, 12);
    expect(STACK_OVERLAP_FRACTION).toBeCloseTo(0.1339745962, 9);
  });

  it("holds one fewer bottle than the row it nests into", () => {
    expect(stackCapacity(5)).toBe(4);
    expect(stackCapacity(1)).toBe(0);
    expect(stackCapacity(0)).toBe(0);
  });

  it("sits at the true valley between the two beneath", () => {
    const base = row(430, [76, 76, 76, 76, 76]);
    const stack = nestOverBase(row(430, [76, null, null, null]), base);
    const expected = (base.items[0]!.centrePct + base.items[1]!.centrePct) / 2;
    expect(stack.items[0]!.centrePct).toBeCloseTo(expected, 9);
  });

  /* A stack resting on mismatched widths sits off-centre, as it would in the
     cabinet -- that is the point of using the real centres rather than a pitch. */
  it("sits off-centre when the two beneath are different widths", () => {
    const base = row(430, [90, 72, 76, 76, 76]);
    const stack = nestOverBase(row(430, [76, null, null, null]), base);
    const valley = (base.items[0]!.centrePct + base.items[1]!.centrePct) / 2;
    expect(stack.items[0]!.centrePct).toBeCloseTo(valley, 9);

    const evenPitch = row(430, [76, 76, 76, 76, 76]);
    const evenStack = nestOverBase(row(430, [76, null, null, null]), evenPitch);
    expect(stack.items[0]!.centrePct).not.toBeCloseTo(evenStack.items[0]!.centrePct, 3);
  });

  it("still draws a stack row over an empty base row", () => {
    expect(stackOverlapPct(row(430, [null, null, null, null, null]))).toBeGreaterThan(0);
  });

  it("overlaps by the mean width of the wine actually beneath", () => {
    const base = row(430, [90, 90, null, null, null]);
    expect(stackOverlapPct(base)).toBeCloseTo(STACK_OVERLAP_FRACTION * 90 * base.scale, 9);
  });
});
