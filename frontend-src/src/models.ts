import type { BottleShape } from "./geometry";

export interface TastingNotes {
  aroma: string;
  taste: string;
  finish: string;
  overall: string;
}

export interface Wine {
  id: string;
  barcode: string;
  name: string;
  winery: string;
  region: string;
  country: string;
  vintage: number | null;
  type: WineType;
  grape_variety: string;
  rating: number | null;
  ratings_count: number | null;
  image_url: string;
  back_image_url: string;
  price: number | null;
  retail_price: number | null;
  retail_price_currency: string | null;
  purchase_date: string;
  drink_by: string;
  notes: string;
  description: string;
  food_pairings: string;
  alcohol: string;
  cabinet_id: string;
  row: number | null;
  col: number | null;
  depth: number;
  zone: string;
  user_rating: number | null;
  tasting_notes: TastingNotes | null;
  added_at: string;
  disposition: string;
  drink_window: string;
  ai_ratings: Record<string, number> | null;
  vivino_updated_at: string | null;
  ai_updated_at: string | null;
  vivino_id: number | null;

  /* --- physical geometry (optional; absent on everything created before it) ---
     A wine with no shape or format is a nominal Bordeaux 750, which is what
     every existing bottle silently was anyway. `base_width_mm` and `length_mm`
     are for a bottle someone actually put a caliper across; they beat the
     shape table when set. */
  shape?: BottleShape | null;
  format_ml?: number | null;
  base_width_mm?: number | null;
  length_mm?: number | null;

  /* Which layer of a stacked row this sits in. Absent means the base row, so
     every existing bottle stays exactly where it is.

     NOT the same axis as `depth`: depth is front-to-back into the rack, this
     is a second course of bottles nested in the valleys ON TOP of the first.
     A cabinet can have both. */
  layer?: BottleLayer | null;
}

export type BottleLayer = "base" | "stack";

export type StorageRowType = "bulk" | "box";

export const STORAGE_ROW_TYPE_LABELS: Record<StorageRowType, string> = {
  bulk: "Bulk Bin",
  box: "Wine Box",
};

export const BOX_SIZES = [1, 3, 6, 12, 24] as const;

export interface StorageRow {
  row: number;
  name: string;
  type: StorageRowType;
  capacity: number;
  boxes?: number[];  // for type="box": array of box sizes, e.g. [6, 12, 3]
}

export interface Cabinet {
  id: string;
  name: string;
  type: "grid" | "zone";
  rows: number;
  cols: number;
  depth: number;
  has_bottom_zone: boolean;
  bottom_zone_name: string;
  storage_rows: StorageRow[];
  order: number;

  /* --- physical geometry (optional) ---
     The measured internal width of the cabinet. Setting it switches the grid
     from equal cells to a drawing at true scale: every bottle at its real base
     width, so a magnum visibly crowds its neighbours and an over-full row
     visibly overflows. Leave it unset and the rack renders exactly as it
     always has. */
  internal_width_mm?: number | null;

  /* Row indices that carry a second course of bottles nested in the valleys
     above them. A stack row holds one fewer bottle than the row beneath it. */
  stacked_rows?: number[] | null;

  /* The clear vertical gap between one shelf and the next. In a cabinet whose
     shelves do not move this is a fixed, real constraint, and it is what a
     bottle's DIAMETER has to clear -- not its length, which runs back into the
     depth. Set it and the drawing uses the same millimetres-per-pixel
     vertically as it does horizontally, so a bottle too fat for the gap is
     seen not fitting. Leave it unset and rows size themselves to their
     contents as before. */
  shelf_height_mm?: number | null;
}

export interface CellarStats {
  total_bottles: number;
  total_capacity: number;
  available_slots: number;
  total_value: number;
  total_cost: number;
  by_type: Record<string, number>;
  by_cabinet: Record<string, number>;
}

export interface BarcodeLookupResult {
  name: string;
  winery: string;
  region: string;
  country: string;
  vintage: number | null;
  type: WineType;
  grape_variety: string;
  rating: number | null;
  image_url: string;
  price: number | null;
  source: string;
}

export interface WineListItem {
  index: number;
  name: string;
  winery: string;
  vintage: number | null;
  type: WineType;
  region: string;
  country: string;
  grape_variety: string;
  list_price: number | null;
  list_price_currency: string;
  glass_price: number | null;
  bottle_size: string;
  // Enriched by Vivino
  vivino_rating: number | null;
  vivino_ratings_count: number | null;
  vivino_price: number | null;
  vivino_image_url: string;
  // Enriched by AI
  ai_ratings: Record<string, number> | null;
  ai_description: string;
  ai_disposition: string;
  ai_drink_window: string;
  ai_estimated_price: number | null;
  // Status
  vivino_status: "pending" | "loading" | "done" | "error";
  ai_status: "pending" | "loading" | "done" | "error" | "skipped";
}

export interface WineHistoryItem {
  id: string;
  original_id: string;
  name: string;
  winery: string;
  vintage: number | null;
  type: string;
  region: string;
  country: string;
  grape_variety: string;
  rating: number | null;
  price: number | null;
  image_url: string;
  added_at: string;
  removed_at: string;
  reason: string;
}

export const REMOVAL_REASONS = [
  { id: "drank", label: "Drank" },
  { id: "gifted", label: "Gifted" },
  { id: "sold", label: "Sold" },
  { id: "broken", label: "Broken" },
  { id: "spoiled", label: "Spoiled" },
  { id: "other", label: "Other" },
] as const;

export type WineType = "red" | "white" | "rosé" | "sparkling" | "dessert";

export const WINE_TYPE_COLORS: Record<WineType, string> = {
  red: "#722F37",
  white: "#F5E6CA",
  rosé: "#E8A0BF",
  sparkling: "#D4E09B",
  dessert: "#DAA520",
};

export const WINE_TYPE_LABELS: Record<WineType, string> = {
  red: "Red",
  white: "White",
  rosé: "Rosé",
  sparkling: "Sparkling",
  dessert: "Dessert",
};

// Every physical (row, col) grid slot in a cabinet, in display order,
// skipping rows configured as bulk/box storage zones.
export function getRackSlots(cabinet: Cabinet): { row: number; col: number }[] {
  const storageRowSet = new Set((cabinet.storage_rows || []).map((sr) => sr.row));
  const slots: { row: number; col: number }[] = [];
  for (let r = 0; r < cabinet.rows; r++) {
    if (storageRowSet.has(r)) continue;
    for (let c = 0; c < cabinet.cols; c++) slots.push({ row: r, col: c });
  }
  return slots;
}

export interface WineLocation {
  text: string;
  cabinet: Cabinet | null;
  zone: string;
  storageRow: StorageRow | null;
}

// A precise, human-readable location for a wine: cabinet name, plus the
// zone name and slot number when it's in a bulk bin or wine box, or the
// rack's linear slot number when it's in a grid cell.
export function getWineLocation(wine: Wine, cabinets: Cabinet[]): WineLocation {
  const cabinet = wine.cabinet_id ? cabinets.find((c) => c.id === wine.cabinet_id) || null : null;
  if (!cabinet) return { text: "Unassigned", cabinet: null, zone: "", storageRow: null };

  if (wine.row !== null && wine.col !== null) {
    const slotIdx = getRackSlots(cabinet).findIndex((s) => s.row === wine.row && s.col === wine.col);
    const slotLabel = slotIdx >= 0 ? `Slot ${slotIdx + 1}` : `R${wine.row + 1}C${wine.col + 1}`;
    return { text: `${cabinet.name} · ${slotLabel}`, cabinet, zone: "", storageRow: null };
  }

  if (wine.zone && wine.zone !== "bottom") {
    const rowIdx = parseInt(wine.zone.replace("storage-", ""), 10);
    const storageRow = (cabinet.storage_rows || []).find((sr) => sr.row === rowIdx) || null;
    const zoneName = storageRow?.name || "Storage";
    return { text: `${cabinet.name} · ${zoneName} · Slot ${(wine.depth || 0) + 1}`, cabinet, zone: wine.zone, storageRow };
  }

  if (wine.zone === "bottom") {
    return { text: `${cabinet.name} · ${cabinet.bottom_zone_name || "Storage"}`, cabinet, zone: "bottom", storageRow: null };
  }

  return { text: cabinet.name, cabinet, zone: "", storageRow: null };
}
