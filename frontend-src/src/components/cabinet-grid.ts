import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Cabinet, Wine, StorageRow, WINE_TYPE_COLORS, WineType } from "../models";
import { sharedStyles } from "../styles";
import {
  EMPTY_REFERENCE_MM,
  STACK_OVERLAP_FRACTION,
  bottleDims,
  layoutRow,
  nestOverBase,
  stackCapacity,
} from "../geometry";
import type { RowLayout } from "../geometry";

@customElement("cabinet-grid")
export class CabinetGrid extends LitElement {
  @property({ attribute: false }) cabinet!: Cabinet;
  @property({ attribute: false }) wines: Wine[] = [];

  @state() private _dragOverCell: string | null = null;

  static styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }

      .cabinet {
        background: linear-gradient(135deg, #8b6914 0%, #c4973b 50%, #8b6914 100%);
        border-radius: 12px;
        padding: 8px;
        box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.3),
          0 4px 12px rgba(0, 0, 0, 0.2);
      }

      .cabinet-name {
        text-align: center;
        color: #f5e6ca;
        font-size: 0.8em;
        font-weight: 600;
        padding: 4px 0;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
      }

      .cabinet-name.clickable {
        cursor: pointer;
        border-radius: 6px;
      }

      .cabinet-name.clickable:hover {
        background: rgba(255, 255, 255, 0.08);
      }

      .grid-inner {
        background: linear-gradient(180deg, #1a1a3a 0%, #0d0d2b 100%);
        border-radius: 8px;
        padding: 6px;
        position: relative;
        overflow: hidden;
      }

      /* Blue LED glow effect */
      .grid-inner::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: radial-gradient(
          ellipse at center,
          rgba(50, 100, 255, 0.15) 0%,
          transparent 70%
        );
        pointer-events: none;
      }

      .row {
        display: flex;
        gap: 2px;
        margin-bottom: 2px;
        position: relative;
      }

      /* Scalloped shelf appearance */
      .row::after {
        content: "";
        position: absolute;
        bottom: -1px;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, #6b5010 0%, #a07828 50%, #6b5010 100%);
        border-radius: 0 0 2px 2px;
      }

      .cell {
        flex: 1;
        aspect-ratio: 1;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
        position: relative;
        min-width: 0;
        z-index: 1;
        container-type: inline-size;
      }

      /* ================= to-scale rows =================================
         Used only when the cabinet has a measured internal width. Scoped to
         .to-scale throughout so a rack without one keeps upstream's look
         exactly.

         A bottle seen from above is a CIRCLE OF ITS OWN DIAMETER, so a heavy
         Bordeaux is a bigger circle than a standard one -- not a wider
         ellipse. Cells are therefore sized by width alone, with aspect-ratio 1
         and centred on the row's midline; the row is as tall as its widest
         bottle. */

      .grid-inner.to-scale {
        /* Warm and dark, like the inside of a cabinet. Upstream's navy and its
           blue glow are wrong for wine and are not inherited here. */
        background: linear-gradient(180deg, #1f1a16 0%, #131010 100%);
        padding: 12px 12px 6px;
        /* A cabinet has to fit on a screen. Widths stay proportional -- that is
           the information -- but the whole drawing is capped so a rack is not
           taller than it is wide. */
        max-width: 380px;
        margin: 0 auto;
      }
      .grid-inner.to-scale::before {
        background: radial-gradient(
          ellipse at 50% 0%,
          rgba(198, 151, 73, 0.10) 0%,
          transparent 65%
        );
      }

      .row.to-scale {
        display: block;
        gap: 0;
        position: relative;
        /* a bottle too fat for the shelf gap rises past it, and is seen doing
           so rather than being silently shrunk to fit */
        overflow: visible;
      }

      /* The shelf the bottles rest on: a thin oak edge with a lit top arris
         and a shadow falling away beneath it. */
      .row.to-scale.shelf-space::after {
        content: "";
        position: absolute;
        left: -6px;
        right: -6px;
        bottom: -3px;
        height: 4px;
        border-radius: 1px;
        background: linear-gradient(180deg, #6d523049 0%, #8a6a3e 35%, #4a3720 100%);
        box-shadow: 0 3px 7px rgba(0, 0, 0, 0.55);
        z-index: 0;
      }

      /* Bottles REST ON the shelf. Centring them in the row made a small
         bottle float above the shelf line while a large one crossed it, which
         is why the lines never looked like they were holding anything up. */
      .row.to-scale .cell {
        position: absolute;
        top: auto;
        bottom: 0;
        transform: none;
        flex: none;
        aspect-ratio: 1;
        border-radius: 50%;
        overflow: visible;
        z-index: 1;
      }

      /* ---- a bottle, seen from above -------------------------------------
         Looking down at a rack you see dark glass and a capsule, not a disc of
         wine-coloured plastic. So the body is glass -- deeply darkened, only
         faintly tinted by what is in it -- and the CAPSULE at the centre
         carries the wine type at full strength. That keeps type instantly
         readable while letting the thing that actually matters here, the
         bottle's diameter, be what the eye measures. */
      .row.to-scale .cell.filled {
        border: none;
        background:
          /* specular highlight, offset up and left as if lit from the front */
          radial-gradient(
            circle at 32% 25%,
            rgba(255, 255, 255, 0.50) 0%,
            rgba(255, 255, 255, 0.13) 15%,
            transparent 33%
          ),
          /* a bright arc along the far rim, where glass catches the light */
          radial-gradient(
            circle at 70% 78%,
            rgba(255, 255, 255, 0.20) 0%,
            transparent 26%
          ),
          /* The glass itself. Bottle glass is DARK GREEN whatever is inside it,
             so the base is green and the wine type is only a hint through it --
             tint it by the liquid colour and a sparkling turns into a pale
             olive puck, which is not what a rack looks like. Type is carried
             at full strength by the capsule instead. */
          radial-gradient(
            circle at 50% 43%,
            color-mix(in srgb, var(--wine, #722f37) 26%, #232b1f) 0%,
            color-mix(in srgb, var(--wine, #722f37) 17%, #151a12) 60%,
            color-mix(in srgb, var(--wine, #722f37) 8%, #060806) 100%
          );
        box-shadow:
          0 3px 7px rgba(0, 0, 0, 0.62),
          inset 0 0 0 1px rgba(255, 255, 255, 0.20),
          inset 0 1px 1px rgba(255, 255, 255, 0.12),
          inset 0 -5px 9px rgba(0, 0, 0, 0.5);
      }

      /* the capsule over the cork: the wine type, at full strength, small */
      .row.to-scale .cell.filled::after {
        content: "";
        position: absolute;
        /* a capsule is roughly 30% of the base diameter -- 29 mm across a
           76 mm Bordeaux -- so it reads as a bottle top, not a bullseye */
        inset: 34%;
        border-radius: 50%;
        background:
          radial-gradient(
            circle at 36% 28%,
            rgba(255, 255, 255, 0.45) 0%,
            rgba(255, 255, 255, 0.12) 30%,
            transparent 60%
          ),
          radial-gradient(
            circle at 50% 50%,
            color-mix(in srgb, var(--wine, #722f37) 92%, #fff) 0%,
            var(--wine, #722f37) 55%,
            color-mix(in srgb, var(--wine, #722f37) 70%, #000) 100%
          );
        box-shadow:
          inset 0 0 0 1px rgba(0, 0, 0, 0.30),
          0 1px 2px rgba(0, 0, 0, 0.5);
        pointer-events: none;
      }

      /* ---- an empty position ---------------------------------------------
         Recessed and quiet. It contributes nothing to the row's width and must
         never read as louder than the wine. */
      /* An empty position is a MARKER, not a ghost bottle. Drawn at full
         bottle diameter it turns a sparse cabinet into a field of circles with
         the wine lost among them -- and this cabinet is mostly empty, which is
         its normal condition. Small, thin, and low contrast. */
      .row.to-scale .cell.empty {
        background: none;
        border: 1px solid rgba(214, 197, 176, 0.13);
        box-shadow: none;
      }
      .row.to-scale .cell.empty:hover {
        background: rgba(255, 255, 255, 0.05);
        border-color: rgba(214, 197, 176, 0.32);
      }

      /* ---- the stack row --------------------------------------------------
         Nested in the valleys on top, so it needs to read as ABOVE: a deeper
         shadow, and it paints over the base row. */
      /* The second course sits above and in front, so it paints over the
         first and casts a deeper shadow onto it. */
      .row.to-scale .cell.stacked {
        z-index: 2;
      }
      .row.to-scale .cell.stacked.filled {
        box-shadow:
          0 6px 12px rgba(0, 0, 0, 0.66),
          inset 0 0 0 1px rgba(255, 255, 255, 0.18),
          inset 0 -3px 6px rgba(0, 0, 0, 0.35);
      }
      .row.to-scale .cell.stacked.empty {
        border-style: dotted;
        opacity: 0.55;
      }

      .row.to-scale .cell.drag-over {
        outline: 2px solid #c69749;
        outline-offset: 2px;
      }

      /* ---- overlays, resized for a to-scale cell --------------------------
         Upstream draws the disposition as a disc across 65% of the cell. That
         reads well at 30 px, but a to-scale cell is 80 px and the disc then
         covers the bottle -- and the bottle's SIZE is the information here. So
         in this mode the disposition becomes a pip on the rim: same colour,
         same letter, out of the way. */
      .row.to-scale .cell .disposition {
        top: auto;
        left: auto;
        right: -1%;
        bottom: -1%;
        transform: none;
        width: 26%;
        height: 26%;
        font-size: clamp(5px, 11cqi, 9px);
        opacity: 0.82;
        border-width: 1px;
        border-color: rgba(0, 0, 0, 0.35);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
      }

      /* The label photograph becomes the disc at the centre, where the capsule
         would be -- a bottle from above has no label face to show, but the
         picture is still how you recognise it. */
      .row.to-scale .cell .wine-thumb {
        inset: 32%;
        width: auto;
        height: auto;
        box-shadow:
          0 0 0 1px rgba(255, 255, 255, 0.14),
          0 1px 3px rgba(0, 0, 0, 0.5);
      }
      /* ...and then the drawn capsule would sit on top of it, so it stands down */
      .row.to-scale .cell.filled:has(.wine-thumb)::after {
        display: none;
      }

      .row.to-scale .cell .depth-badge {
        top: -2%;
        left: -2%;
        width: 28%;
        height: 28%;
        min-width: 12px;
        min-height: 12px;
        font-size: clamp(6px, 12cqi, 10px);
      }

      .row.to-scale .cell.filled:hover {
        filter: brightness(1.12);
      }

      /* An over-capacity row runs past the shelf edge. The drawing says so on
         its own; there is no commentary. */
      .row.to-scale.over-capacity::before {
        content: "";
        position: absolute;
        top: -4px;
        bottom: -4px;
        right: -10px;
        width: 26px;
        background: linear-gradient(90deg, transparent, rgba(180, 70, 40, 0.55));
        z-index: 3;
        pointer-events: none;
      }

      .cell.empty {
        background: rgba(255, 255, 255, 0.05);
        border: 1px dashed rgba(255, 255, 255, 0.15);
      }

      .cell.empty:hover {
        background: rgba(255, 255, 255, 0.12);
        border-color: rgba(255, 255, 255, 0.3);
      }

      .cell.filled {
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4),
          inset 0 -2px 4px rgba(0, 0, 0, 0.3),
          0 0 8px rgba(50, 100, 255, 0.15);
        border: 2px solid var(--bottle-type-color, rgba(255, 255, 255, 0.1));
        overflow: hidden;
      }

      .cell .wine-thumb {
        position: absolute;
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 50%;
      }

      .cell.filled:hover {
        transform: scale(1.15);
        z-index: 10;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5),
          0 0 16px rgba(50, 100, 255, 0.3);
      }

      .cell .bottle-label {
        position: absolute;
        bottom: -14px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 6px;
        color: rgba(255, 255, 255, 0.6);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 40px;
        display: none;
        pointer-events: none;
      }

      .cell.filled:hover .bottle-label {
        display: block;
      }

      .cell .disposition {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 65%;
        height: 65%;
        border-radius: 50%;
        font-size: clamp(7px, 30cqi, 14px);
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        z-index: 2;
        pointer-events: none;
        line-height: 1;
        border: 2px solid rgba(255, 255, 255, 0.5);
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
      }

      .cell .disposition.drink,
      .zone-bottle .disposition.drink {
        background: #2e7d32;
      }

      .cell .disposition.hold,
      .zone-bottle .disposition.hold {
        background: #1565c0;
      }

      .cell .disposition.past,
      .zone-bottle .disposition.past {
        background: #c62828;
      }

      .cell .rating-badge {
        position: absolute;
        bottom: -2px;
        right: -2px;
        font-size: 6px;
        font-weight: 700;
        color: #fff;
        background: rgba(0,0,0,0.6);
        border-radius: 4px;
        padding: 1px 3px;
        z-index: 2;
        pointer-events: none;
        line-height: 1;
        display: none;
      }

      .cell.filled:hover .rating-badge {
        display: block;
      }

      .cell .depth-badge {
        position: absolute;
        top: -2px;
        left: -2px;
        font-size: 7px;
        font-weight: 700;
        color: #fff;
        background: rgba(30, 136, 229, 0.85);
        border-radius: 50%;
        width: 14px;
        height: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 3;
        pointer-events: none;
        border: 1px solid rgba(255, 255, 255, 0.5);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
      }

      .depth-dots {
        position: absolute;
        bottom: 16%;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 3px;
        z-index: 3;
        pointer-events: none;
      }

      .depth-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        border: 1.5px solid rgba(255, 255, 255, 0.6);
        box-shadow: 0 0 3px rgba(0, 0, 0, 0.6);
      }

      .depth-dot.empty {
        background: rgba(255, 255, 255, 0.12);
        border-color: rgba(255, 255, 255, 0.25);
      }

      .bottom-zone {
        margin-top: 8px;
        background: linear-gradient(135deg, #6b5010 0%, #8b6914 100%);
        border-radius: 6px;
        padding: 8px;
        min-height: 40px;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
        cursor: pointer;
        position: relative;
        z-index: 1;
      }

      .bottom-zone-label {
        font-size: 0.65em;
        color: rgba(255, 255, 255, 0.6);
        width: 100%;
        text-align: center;
      }

      .zone-bottle {
        position: relative;
        width: 28px;
        height: 28px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 8px;
        color: #fff;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        transition: transform 0.2s;
      }

      .zone-bottle .disposition {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 68%;
        height: 68%;
        border-radius: 50%;
        font-size: 9px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        z-index: 2;
        pointer-events: none;
        line-height: 1;
        border: 1.5px solid rgba(255, 255, 255, 0.5);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
      }

      .zone-bottle:hover {
        transform: scale(1.1);
      }

      /* Drag and drop */
      .cell.drag-source {
        opacity: 0.35;
        transform: scale(0.9);
      }

      .cell.drag-over {
        box-shadow: 0 0 0 3px rgba(66, 165, 245, 0.8);
        transform: scale(1.1);
        background: rgba(66, 165, 245, 0.15) !important;
        z-index: 10;
      }

      .cell[draggable="true"] {
        cursor: grab;
      }

      .cell[draggable="true"]:active {
        cursor: grabbing;
      }

      .zone-bottle.drag-over {
        box-shadow: 0 0 0 2px rgba(66, 165, 245, 0.8);
        transform: scale(1.15);
      }

      .bottom-zone.drag-over {
        box-shadow: inset 0 0 0 2px rgba(66, 165, 245, 0.8);
        background: rgba(66, 165, 245, 0.1);
      }

      .zone-count {
        font-weight: 400;
        opacity: 0.7;
        margin-left: 4px;
      }

      .zone-fill-dots {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        align-items: center;
      }

      .zone-fill-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        border: 1.5px solid rgba(255, 255, 255, 0.4);
        box-shadow: 0 0 2px rgba(0, 0, 0, 0.4);
      }

      .zone-fill-dot.empty {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.2);
      }

      .zone-box-row {
        cursor: pointer;
        padding: 4px 8px;
        min-height: 0;
        flex-direction: column;
        align-items: center;
      }

      .zone-box-row:hover {
        background: linear-gradient(135deg, #7a5a12 0%, #9a7820 100%);
      }

      .zone-box-grid {
        display: flex;
        gap: 8px;
        align-items: flex-end;
        justify-content: center;
        padding: 2px 0;
        width: 100%;
      }

      .zone-box-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1px;
      }

      .zone-box-shape {
        width: 56px;
        height: 36px;
        position: relative;
      }

      .zone-box-shape .box-lid {
        position: absolute;
        top: 0;
        left: -2px;
        right: -2px;
        height: 28%;
        background: linear-gradient(180deg, #a08040 0%, #7a6020 100%);
        border-radius: 2px 2px 0 0;
        border: 1px solid rgba(255, 255, 255, 0.25);
        border-bottom: none;
      }

      .zone-box-shape .box-body {
        position: absolute;
        top: 28%;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(180deg, #8b6914 0%, #6b5010 100%);
        border-radius: 0 0 2px 2px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-top: 1px solid rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .zone-box-shape .box-count {
        font-size: 0.7em;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.5);
        line-height: 1;
      }

      .zone-box-item.has-wine .box-count {
        color: #fff;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
      }

      .zone-box-size {
        font-size: 0.55em;
        color: rgba(255, 255, 255, 0.5);
      }

      /* Phone: tighter spacing, smaller elements */
      @media (max-width: 599px) {
        .cabinet {
          padding: 6px;
          border-radius: 10px;
        }
        .cabinet-name {
          font-size: 0.75em;
          padding: 3px 0;
        }
        .grid-inner {
          padding: 4px;
        }
        .row {
          gap: 1px;
          margin-bottom: 1px;
        }
        .row::after {
          height: 2px;
        }
        .cell .bottle-label {
          font-size: 5px;
          max-width: 30px;
        }
        .bottom-zone {
          margin-top: 6px;
          padding: 6px;
          gap: 4px;
          min-height: 32px;
        }
        .bottom-zone-label {
          font-size: 0.6em;
        }
        .zone-bottle {
          width: 22px;
          height: 22px;
          font-size: 7px;
        }
      }

      /* Tablet: moderate sizing */
      @media (min-width: 600px) and (max-width: 1023px) {
        .cabinet {
          padding: 6px;
        }
        .grid-inner {
          padding: 5px;
        }
        .row {
          gap: 2px;
          margin-bottom: 1px;
        }
      }
    `,
  ];

  private _getWinesAt(row: number, col: number, layer: "base" | "stack" = "base"): Wine[] {
    return this.wines.filter(
      (w) =>
        w.cabinet_id === this.cabinet.id &&
        w.row === row &&
        w.col === col &&
        /* A wine with no layer is in the base row, which is where every bottle
           created before stacking existed. */
        (w.layer || "base") === layer
    );
  }

  /* ------------------------------------------------ physical geometry ---- */

  /* The measured internal width of the cabinet, or null when it was never
     entered. Null means every rack below renders exactly as it always has. */
  private _scaleWidthMm(): number | null {
    const mm = this.cabinet.internal_width_mm;
    return typeof mm === "number" && mm > 0 ? mm : null;
  }

  /* The clear gap between one shelf and the next, when it was measured. */
  private _shelfHeightMm(): number | null {
    const mm = this.cabinet.shelf_height_mm;
    return typeof mm === "number" && mm > 0 ? mm : null;
  }

  private _isStacked(row: number): boolean {
    return (this.cabinet.stacked_rows || []).includes(row);
  }

  /* Lay one row out across the cabinet's real internal width, each bottle at
     its own base width. */
  private _rowLayout(row: number, layer: "base" | "stack", count: number, span: number): RowLayout<Wine> {
    return layoutRow<Wine>(
      count,
      span,
      (col) => {
        const wines = this._getWinesAt(row, col, layer);
        /* The front bottle is the one that decides how wide the position is:
           depth goes back into the rack, not across it. */
        return wines.length
          ? wines.sort((a, b) => (a.depth || 0) - (b.depth || 0))[0]!
          : null;
      },
      (wine) => bottleDims(wine).base_width_mm
    );
  }

  private _getStorageRowSet(): Set<number> {
    const rows = (this.cabinet as any).storage_rows as StorageRow[] | undefined;
    return new Set((rows || []).map((sr) => sr.row));
  }

  private _getStorageRowConfig(row: number): StorageRow | undefined {
    const rows = (this.cabinet as any).storage_rows as StorageRow[] | undefined;
    return (rows || []).find((s) => s.row === row);
  }

  private _getStorageRowName(row: number): string {
    return this._getStorageRowConfig(row)?.name || "Storage";
  }

  private _getBottomZoneWines(): Wine[] {
    return this.wines.filter(
      (w) => w.cabinet_id === this.cabinet.id && w.zone === "bottom"
    );
  }

  private _getStorageRowWines(row: number): Wine[] {
    return this.wines
      .filter((w) => w.cabinet_id === this.cabinet.id && w.zone === `storage-${row}`)
      .sort((a, b) => (a.depth || 0) - (b.depth || 0));
  }

  private _onCellClick(row: number, col: number, wine?: Wine, wineCount = 0, cabinetDepth = 1, wines: Wine[] = []) {
    this.dispatchEvent(
      new CustomEvent("cell-click", {
        detail: {
          cabinet: this.cabinet,
          row,
          col,
          wine,
          wines,
          wineCount,
          cabinetDepth,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _onZoneClick(wine?: Wine, zone = "bottom") {
    this.dispatchEvent(
      new CustomEvent("zone-click", {
        detail: {
          cabinet: this.cabinet,
          zone,
          wine,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _onZoneContainerClick(zone: string, storageRow: StorageRow) {
    this.dispatchEvent(
      new CustomEvent("zone-container-click", {
        detail: {
          cabinet: this.cabinet,
          zone,
          storageRow,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _brightenColor(hex: string): string {
    // Make wine type colors brighter for the ring border
    const brightMap: Record<string, string> = {
      "#722F37": "#c44d58",  // red → brighter red
      "#F5E6CA": "#fff8e8",  // white → bright cream
      "#E8A0BF": "#f5c0d8",  // rosé → brighter pink
      "#D4E09B": "#e8f0b8",  // sparkling → brighter green
      "#DAA520": "#f0c040",  // dessert → brighter gold
    };
    return brightMap[hex] || hex;
  }

  // --- Long press (mobile move) ---

  private _longPressTimer: number | null = null;

  private _onTouchStart(wine: Wine) {
    this._longPressTimer = window.setTimeout(() => {
      this._longPressTimer = null;
      this.dispatchEvent(new CustomEvent("wine-longpress", {
        detail: { wine, cabinet: this.cabinet },
        bubbles: true,
        composed: true,
      }));
    }, 500);
  }

  private _onTouchEnd() {
    if (this._longPressTimer !== null) {
      clearTimeout(this._longPressTimer);
      this._longPressTimer = null;
    }
  }

  private _onTouchMove() {
    if (this._longPressTimer !== null) {
      clearTimeout(this._longPressTimer);
      this._longPressTimer = null;
    }
  }

  // --- Drag and drop ---

  private _onDragStart(e: DragEvent, wine: Wine, row?: number, col?: number, zone?: string) {
    if (!e.dataTransfer) return;
    e.dataTransfer.setData("text/plain", JSON.stringify({
      wineId: wine.id,
      cabinetId: this.cabinet.id,
      row: row ?? null,
      col: col ?? null,
      zone: zone || "",
    }));
    e.dataTransfer.effectAllowed = "move";
    (e.currentTarget as HTMLElement).classList.add("drag-source");
  }

  private _onDragEnd(e: DragEvent) {
    (e.currentTarget as HTMLElement).classList.remove("drag-source");
    this._dragOverCell = null;
  }

  private _onDragOver(e: DragEvent, key: string) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    this._dragOverCell = key;
  }

  private _onDragLeave(_e: DragEvent) {
    this._dragOverCell = null;
  }

  private _onDrop(e: DragEvent, targetRow?: number, targetCol?: number, targetZone?: string, targetWine?: Wine) {
    e.preventDefault();
    this._dragOverCell = null;
    if (!e.dataTransfer) return;
    try {
      const source = JSON.parse(e.dataTransfer.getData("text/plain"));

      // Bulk-zone reordering: figure out which bottle the drop landed
      // nearest to (and which half of it), so dropping anywhere in the zone
      // reorders sensibly instead of only working when the cursor lands
      // exactly on a chip — small chips are hard to hit precisely.
      let effectiveTargetWine = targetWine;
      let insertBefore = true;
      if (effectiveTargetWine) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        insertBefore = e.clientX < rect.left + rect.width / 2;
      } else if (targetZone) {
        const container = e.currentTarget as HTMLElement;
        const chips = Array.from(container.querySelectorAll<HTMLElement>(".zone-bottle"));
        let nearest: HTMLElement | null = null;
        let nearestDist = Infinity;
        for (const chip of chips) {
          if (chip.dataset.wineId === source.wineId) continue;
          const rect = chip.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const dist = Math.abs(e.clientX - cx);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = chip;
          }
        }
        if (nearest) {
          const rect = nearest.getBoundingClientRect();
          insertBefore = e.clientX < rect.left + rect.width / 2;
          effectiveTargetWine = this.wines.find((w) => w.id === nearest!.dataset.wineId);
        }
      }

      this.dispatchEvent(new CustomEvent("wine-drop", {
        detail: {
          wineId: source.wineId,
          sourceCabinetId: source.cabinetId,
          sourceRow: source.row,
          sourceCol: source.col,
          sourceZone: source.zone,
          targetCabinetId: this.cabinet.id,
          targetRow: targetRow ?? null,
          targetCol: targetCol ?? null,
          targetZone: targetZone || "",
          // When dropping on/near another bottle within the same bulk
          // zone, carry its id + which side the drop landed on, so the
          // card can insert relative to it instead of treating it as a
          // same-zone no-op.
          targetWineId: effectiveTargetWine?.id ?? null,
          targetDepth: effectiveTargetWine ? (effectiveTargetWine.depth ?? 0) : null,
          insertBefore,
        },
        bubbles: true,
        composed: true,
      }));
    } catch { /* ignore bad data */ }
  }

  private _renderStorageZone(row: number) {
    const sr = this._getStorageRowConfig(row);
    const zoneName = sr?.name || "Storage";
    const zoneType = sr?.type || "bulk";
    const capacity = sr?.capacity || 20;
    const zoneId = `storage-${row}`;
    const wines = this._getStorageRowWines(row);
    const zoneKey = `zone-${zoneId}`;
    const isDragOver = this._dragOverCell === zoneKey;

    if (zoneType === "box") {
      return this._renderBoxZone(zoneId, zoneKey, zoneName, capacity, wines, isDragOver, sr!);
    }
    // Default: bulk
    return this._renderBulkZone(zoneId, zoneKey, zoneName, capacity, wines, isDragOver, sr!);
  }

  private _renderBulkZone(zoneId: string, zoneKey: string, name: string, capacity: number, wines: Wine[], isDragOver: boolean, sr: StorageRow) {
    return html`
      <div class="bottom-zone ${isDragOver ? "drag-over" : ""}"
        @click=${() => sr ? this._onZoneContainerClick(zoneId, sr) : this._onZoneClick(undefined, zoneId)}
        @dragover=${(e: DragEvent) => this._onDragOver(e, zoneKey)}
        @dragleave=${(e: DragEvent) => this._onDragLeave(e)}
        @drop=${(e: DragEvent) => this._onDrop(e, undefined, undefined, zoneId)}>
        <div class="bottom-zone-label">◇ ${name} <span class="zone-count">${wines.length}/${capacity}</span></div>
        ${wines.map((wine) => {
          const disp = wine.disposition || "";
          const dispClass = disp === "D" ? "drink" : disp === "H" ? "hold" : disp === "P" ? "past" : "";
          const bottleKey = `${zoneKey}-${wine.id}`;
          return html`
            <div
              class="zone-bottle ${this._dragOverCell === bottleKey ? "drag-over" : ""}"
              style="background: ${WINE_TYPE_COLORS[wine.type as WineType] || WINE_TYPE_COLORS.red}"
              data-wine-id="${wine.id}"
              draggable="true"
              @click=${(e: Event) => {
                e.stopPropagation();
                this._onZoneClick(wine, zoneId);
              }}
              @dragstart=${(e: DragEvent) => { e.stopPropagation(); this._onDragStart(e, wine, undefined, undefined, zoneId); }}
              @dragend=${(e: DragEvent) => this._onDragEnd(e)}
              @dragover=${(e: DragEvent) => { e.stopPropagation(); this._onDragOver(e, bottleKey); }}
              @dragleave=${(e: DragEvent) => { e.stopPropagation(); this._onDragLeave(e); }}
              @drop=${(e: DragEvent) => { e.stopPropagation(); this._onDrop(e, undefined, undefined, zoneId, wine); }}
              @touchstart=${(e: TouchEvent) => { e.stopPropagation(); this._onTouchStart(wine); }}
              @touchend=${() => this._onTouchEnd()}
              @touchmove=${() => this._onTouchMove()}
              title="${wine.name} (${wine.vintage || "NV"})"
            >
              ${(wine.vintage || "NV").toString().slice(-2)}
              ${dispClass ? html`<span class="disposition ${dispClass}">${disp}</span>` : nothing}
            </div>
          `;
        })}
      </div>
    `;
  }

  private _renderBoxZone(zoneId: string, zoneKey: string, name: string, capacity: number, wines: Wine[], isDragOver: boolean, sr: StorageRow) {
    const boxes = sr.boxes || [capacity];
    let offset = 0;
    const boxSegments = boxes.map((boxSize) => {
      const start = offset;
      offset += boxSize;
      const boxWines = wines.filter((w) => {
        const d = w.depth || 0;
        return d >= start && d < start + boxSize;
      });
      return { size: boxSize, start, wineCount: boxWines.length };
    });

    return html`
      <div class="bottom-zone zone-box-row ${isDragOver ? "drag-over" : ""}"
        @click=${() => this._onZoneContainerClick(zoneId, sr)}
        @dragover=${(e: DragEvent) => this._onDragOver(e, zoneKey)}
        @dragleave=${(e: DragEvent) => this._onDragLeave(e)}
        @drop=${(e: DragEvent) => this._onDrop(e, undefined, undefined, zoneId)}>
        <div class="bottom-zone-label">📦 ${name} <span class="zone-count">${wines.length}/${capacity}</span></div>
        <div class="zone-box-grid">
          ${boxSegments.map((seg) => html`
            <div class="zone-box-item ${seg.wineCount > 0 ? "has-wine" : ""}">
              <div class="zone-box-shape">
                <div class="box-lid"></div>
                <div class="box-body"><span class="box-count">${seg.wineCount}/${seg.size}</span></div>
              </div>
              <div class="zone-box-size">${seg.size}-pk</div>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  /* A row drawn to the cabinet's real internal width.
   *
   * Used only when `internal_width_mm` is set. Every number here comes out of
   * geometry.ts -- this method does no arithmetic of its own, which is what
   * stops a rendering tweak quietly re-breaking either of the two rules the
   * drawing depends on. */
  private _renderScaleRow(row: number, cols: number, span: number) {
    const base = this._rowLayout(row, "base", cols, span);
    const stacked = this._isStacked(row);
    const stackCount = stackCapacity(cols);
    const stack = stacked && stackCount > 0
      ? nestOverBase(this._rowLayout(row, "stack", stackCount, span), base)
      : null;

    /* An empty position draws as a small marker rather than a full-diameter
       ghost bottle. It still contributes nothing to the row's width; this is
       only about how loud it is, and in a mostly-empty cabinet -- which is the
       normal condition -- full-size rings drown the wine. */
    const drawnPct = (item: RowLayout<Wine>["items"][number]) =>
      item.occupant ? item.widthPct : item.emptyRefPct * 0.46;
    /* ...and its real height in millimetres, which is what has to clear the
       shelf above. A bottle lying down is as tall as it is wide. */
    const drawnMm = (item: RowLayout<Wine>["items"][number]) =>
      item.occupant ? item.mm : EMPTY_REFERENCE_MM * 0.46;

    /* How high the second course sits: two tangent circles whose centres are
       one radius apart, so the upper one rests sqrt(3)/2 of a diameter above
       the shelf, not a whole one. */
    const beneath = base.items.filter((i) => i.mm > 0);
    const meanBaseMm = beneath.length
      ? beneath.reduce((m, i) => m + i.mm, 0) / beneath.length
      : EMPTY_REFERENCE_MM;
    const stackLiftMm = meanBaseMm * (1 - STACK_OVERLAP_FRACTION);

    /* ONE shelf is ONE gap. A stacked shelf does not get two: the second
       course nests inside the same space, which is the whole question of
       whether a stack fits at all. */
    const tallestBaseMm = Math.max(...base.items.map(drawnMm), 1);
    const tallestStackMm = stack ? Math.max(...stack.items.map(drawnMm), 1) : 0;
    const naturalMm = stack
      ? stackLiftMm + tallestStackMm
      : tallestBaseMm;
    const gapMm = this._shelfHeightMm() ?? naturalMm * 1.08;

    /* Same millimetres-per-pixel in both axes: a shelf 430 mm wide and 140 mm
       tall is drawn 430/140. A bottle too fat for the gap then rises past the
       shelf above and is seen doing it -- the vertical twin of a row running
       off the end. */
    const aspect = (span / gapMm).toFixed(4);
    const liftPct = (stackLiftMm / gapMm) * 100;

    const cell = (
      item: RowLayout<Wine>["items"][number],
      layer: "base" | "stack",
      bottomPct: number
    ) => {
      const w = drawnPct(item);
      return this._renderCell(
        row,
        item.index,
        layer,
        `width:${w.toFixed(3)}%;left:${(item.centrePct - w / 2).toFixed(3)}%;` +
          `bottom:${bottomPct.toFixed(3)}%;`
      );
    };

    return html`
      <div
        class="row to-scale shelf-space ${base.overflow ? "over-capacity" : ""}"
        style="aspect-ratio:${aspect}"
      >
        ${base.items.map((item) => cell(item, "base", 0))}
        ${stack ? stack.items.map((item) => cell(item, "stack", liftPct)) : nothing}
      </div>
    `;
  }

  private _renderGridRow(row: number, cols: number) {
    const cabinetDepth = (this.cabinet as any).depth || 1;
    return html`
      <div class="row">
        ${Array.from({ length: cols }, (_, col) => {
          const wines = this._getWinesAt(row, col);
          const wineCount = wines.length;
          const frontWine = wines.length > 0
            ? wines.sort((a, b) => (a.depth || 0) - (b.depth || 0))[0]
            : undefined;
          const bgColor = frontWine
            ? WINE_TYPE_COLORS[frontWine.type as WineType] || WINE_TYPE_COLORS.red
            : "transparent";
          const disp = frontWine?.disposition || "";
          const dispClass = disp === "D" ? "drink" : disp === "H" ? "hold" : disp === "P" ? "past" : "";
          const ratingDisplay = frontWine?.rating ? frontWine.rating.toFixed(1) : "";
          const ringColor = frontWine ? this._brightenColor(bgColor) : "";
          const cellKey = `${row}-${col}`;
          const isDragOver = this._dragOverCell === cellKey;
          return html`
            <div
              class="cell ${frontWine ? "filled" : "empty"} ${layer === "stack" ? "stacked" : ""} ${isDragOver ? "drag-over" : ""}"
              style=${frontWine ? `background: ${bgColor}; --bottle-type-color: ${ringColor}` : ""}
              draggable=${frontWine ? "true" : "false"}
              @click=${() => this._onCellClick(row, col, frontWine, wineCount, cabinetDepth, wines)}
              @touchstart=${frontWine ? () => this._onTouchStart(frontWine) : nothing}
              @touchend=${frontWine ? () => this._onTouchEnd() : nothing}
              @touchmove=${frontWine ? () => this._onTouchMove() : nothing}
              @dragstart=${frontWine ? (e: DragEvent) => this._onDragStart(e, frontWine, row, col) : nothing}
              @dragend=${frontWine ? (e: DragEvent) => this._onDragEnd(e) : nothing}
              @dragover=${(e: DragEvent) => this._onDragOver(e, cellKey)}
              @dragleave=${(e: DragEvent) => this._onDragLeave(e)}
              @drop=${(e: DragEvent) => this._onDrop(e, row, col)}
              title=${frontWine
                ? `${frontWine.name} (${frontWine.vintage || "NV"})${frontWine.rating ? ` ★${frontWine.rating}` : ""}${wineCount > 1 ? ` [${wineCount}/${cabinetDepth} deep]` : ""}`
                : `Empty - Row ${row + 1}, Col ${col + 1}`}
            >
              ${frontWine
                ? html`
                    ${frontWine.image_url ? html`<img class="wine-thumb" src="${frontWine.image_url}" alt="" />` : nothing}
                    <span class="bottle-label">${frontWine.vintage || "NV"}</span>
                    ${dispClass ? html`<span class="disposition ${dispClass}">${disp}</span>` : nothing}
                    ${ratingDisplay ? html`<span class="rating-badge">★${ratingDisplay}</span>` : nothing}
                    ${wineCount > 1 ? html`<span class="depth-badge">${wineCount}</span>` : nothing}
                    ${cabinetDepth >= 2
                      ? html`
                          <span class="depth-dots">
                            ${Array.from({ length: cabinetDepth }, (_, d) => {
                              const wineAtDepth = wines.find((w) => (w.depth || 0) === d);
                              const dotColor = wineAtDepth
                                ? WINE_TYPE_COLORS[wineAtDepth.type as WineType] || WINE_TYPE_COLORS.red
                                : "";
                              return html`<span
                                class="depth-dot ${wineAtDepth ? "" : "empty"}"
                                style=${wineAtDepth ? `background: ${dotColor}` : ""}
                              ></span>`;
                            })}
                          </span>
                        `
                      : nothing}
                  `
                : cabinetDepth >= 2 && wineCount === 0
                  ? html`
                      <span class="depth-dots">
                        ${Array.from({ length: cabinetDepth }, () =>
                          html`<span class="depth-dot empty"></span>`
                        )}
                      </span>
                    `
                  : nothing}
            </div>
          `;
        })}
      </div>
    `;
  }

  private _renderCell(
    row: number,
    col: number,
    layer: "base" | "stack" = "base",
    posStyle = ""
  ) {
    const cabinetDepth = (this.cabinet as any).depth || 1;
    const wines = this._getWinesAt(row, col, layer);
    const wineCount = wines.length;
    const frontWine = wines.length > 0
      ? wines.sort((a, b) => (a.depth || 0) - (b.depth || 0))[0]
      : undefined;
    const bgColor = frontWine
      ? WINE_TYPE_COLORS[frontWine.type as WineType] || WINE_TYPE_COLORS.red
      : "transparent";
    const disp = frontWine?.disposition || "";
    const dispClass = disp === "D" ? "drink" : disp === "H" ? "hold" : disp === "P" ? "past" : "";
    const ratingDisplay = frontWine?.rating ? frontWine.rating.toFixed(1) : "";
    const ringColor = frontWine ? this._brightenColor(bgColor) : "";
    const cellKey = layer === "stack" ? `${row}-${col}-stack` : `${row}-${col}`;
    const isDragOver = this._dragOverCell === cellKey;
    /* In to-scale mode the colour is a custom property the stylesheet builds a
       glass gradient from; a flat background would paint over it. */
    const fillStyle = frontWine
      ? posStyle
        ? `--wine: ${bgColor};`
        : `background: ${bgColor}; --bottle-type-color: ${ringColor};`
      : "";
    return html`
      <div
        class="cell ${frontWine ? "filled" : "empty"} ${layer === "stack" ? "stacked" : ""} ${isDragOver ? "drag-over" : ""}"
        style=${`${fillStyle}${posStyle}` || nothing}
        draggable=${frontWine ? "true" : "false"}
        @click=${() => this._onCellClick(row, col, frontWine, wineCount, cabinetDepth, wines)}
        @touchstart=${frontWine ? () => this._onTouchStart(frontWine) : nothing}
        @touchend=${frontWine ? () => this._onTouchEnd() : nothing}
        @touchmove=${frontWine ? () => this._onTouchMove() : nothing}
        @dragstart=${frontWine ? (e: DragEvent) => this._onDragStart(e, frontWine, row, col) : nothing}
        @dragend=${frontWine ? (e: DragEvent) => this._onDragEnd(e) : nothing}
        @dragover=${(e: DragEvent) => this._onDragOver(e, cellKey)}
        @dragleave=${(e: DragEvent) => this._onDragLeave(e)}
        @drop=${(e: DragEvent) => this._onDrop(e, row, col)}
        title=${frontWine
          ? `${frontWine.name} (${frontWine.vintage || "NV"})${frontWine.rating ? ` ★${frontWine.rating}` : ""}${wineCount > 1 ? ` [${wineCount}/${cabinetDepth} deep]` : ""}`
          : `Empty - Row ${row + 1}, Col ${col + 1}`}
      >
        ${frontWine
          ? html`
              ${frontWine.image_url ? html`<img class="wine-thumb" src="${frontWine.image_url}" alt="" />` : nothing}
              <span class="bottle-label">${frontWine.vintage || "NV"}</span>
              ${dispClass ? html`<span class="disposition ${dispClass}">${disp}</span>` : nothing}
              ${ratingDisplay ? html`<span class="rating-badge">★${ratingDisplay}</span>` : nothing}
              ${wineCount > 1 ? html`<span class="depth-badge">${wineCount}</span>` : nothing}
              ${cabinetDepth >= 2
                ? html`
                    <span class="depth-dots">
                      ${Array.from({ length: cabinetDepth }, (_, d) => {
                        const wineAtDepth = wines.find((w) => (w.depth || 0) === d);
                        const dotColor = wineAtDepth
                          ? WINE_TYPE_COLORS[wineAtDepth.type as WineType] || WINE_TYPE_COLORS.red
                          : "";
                        return html`<span
                          class="depth-dot ${wineAtDepth ? "" : "empty"}"
                          style=${wineAtDepth ? `background: ${dotColor}` : ""}
                        ></span>`;
                      })}
                    </span>
                  `
                : nothing}
            `
          : cabinetDepth >= 2 && wineCount === 0
            ? html`
                <span class="depth-dots">
                  ${Array.from({ length: cabinetDepth }, () =>
                    html`<span class="depth-dot empty"></span>`
                  )}
                </span>
              `
            : nothing}
      </div>
    `;
  }

  private _onRackClick() {
    this.dispatchEvent(
      new CustomEvent("rack-click", {
        detail: { cabinet: this.cabinet },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    const { rows, cols } = this.cabinet;
    const storageRows = this._getStorageRowSet();
    /* null unless the cabinet has a measured internal width, in which case
       every grid row below is drawn to scale instead of as equal cells. */
    const scaleWidth = this._scaleWidthMm();
    const hasGridRows = Array.from({ length: rows }, (_, row) => row).some((row) => !storageRows.has(row));

    return html`
      <div class="cabinet">
        <div
          class="cabinet-name ${hasGridRows ? "clickable" : ""}"
          @click=${hasGridRows ? () => this._onRackClick() : nothing}
          title=${hasGridRows ? "Tap to view and reorder this rack" : ""}
        >${this.cabinet.name}</div>
        <div class="grid-inner ${scaleWidth ? "to-scale" : ""}">
          ${Array.from({ length: rows }, (_, row) =>
              storageRows.has(row)
                ? this._renderStorageZone(row)
                : scaleWidth
                  ? this._renderScaleRow(row, cols, scaleWidth)
                  : this._renderGridRow(row, cols)
            )
          }
        </div>
        ${this.cabinet.has_bottom_zone
          ? html`
              <div class="bottom-zone ${this._dragOverCell === "zone-bottom" ? "drag-over" : ""}"
                @click=${() => this._onZoneClick()}
                @dragover=${(e: DragEvent) => this._onDragOver(e, "zone-bottom")}
                @dragleave=${(e: DragEvent) => this._onDragLeave(e)}
                @drop=${(e: DragEvent) => this._onDrop(e, undefined, undefined, "bottom")}>
                <div class="bottom-zone-label">
                  ${this.cabinet.bottom_zone_name}
                </div>
                ${this._getBottomZoneWines().map(
                  (wine) => html`
                    <div
                      class="zone-bottle"
                      style="background: ${WINE_TYPE_COLORS[wine.type as WineType] || WINE_TYPE_COLORS.red}"
                      draggable="true"
                      @click=${(e: Event) => {
                        e.stopPropagation();
                        this._onZoneClick(wine);
                      }}
                      @dragstart=${(e: DragEvent) => { e.stopPropagation(); this._onDragStart(e, wine, undefined, undefined, "bottom"); }}
                      @dragend=${(e: DragEvent) => this._onDragEnd(e)}
                      title="${wine.name}"
                    >
                      ${(wine.vintage || "NV").toString().slice(-2)}
                    </div>
                  `
                )}
              </div>
            `
          : nothing}
      </div>
    `;
  }
}
