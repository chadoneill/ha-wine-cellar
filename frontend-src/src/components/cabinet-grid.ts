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
  // Set briefly by "locate" so the bottle is marked on the rack drawing too,
  // not just in the side panel's slot list.
  @property({ attribute: false }) highlightWineId: string | null = null;
  // Candidates for a pending Vivino removal: every listed bottle gets an
  // orange ring so the user can see which ones may be the removed bottle.
  @property({ attribute: false }) removalHighlightIds: string[] = [];

  @state() private _dragOverCell: string | null = null;

  static styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }

      /* The cabinet as a piece of furniture rather than a gold bevel: a dark
         neutral case, a hairline edge catching the light along the top, and a
         soft shadow underneath. The old 135deg gold gradient was the loudest
         thing on the page and it was framing, not content. */
      .cabinet {
        background: linear-gradient(180deg, #2a2724 0%, #1c1a18 100%);
        border: 1px solid rgba(255, 255, 255, 0.07);
        border-radius: var(--wc-r-md);
        padding: 10px;
        box-shadow:
          0 1px 0 rgba(255, 255, 255, 0.06) inset,
          0 6px 18px rgba(0, 0, 0, 0.28);
      }

      .cabinet-name {
        text-align: center;
        color: #f5e6ca;
        font-size: var(--wc-fs-sm);
        font-weight: 600;
        padding: 4px 0;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
      }

      .cabinet-name.clickable {
        cursor: pointer;
        border-radius: var(--wc-r-sm);
      }

      .cabinet-name.clickable:hover {
        background: rgba(255, 255, 255, 0.08);
      }

      .grid-inner {
        background: linear-gradient(180deg, #14120f 0%, #0b0a09 100%);
        border-radius: var(--wc-r-sm);
        padding: 8px;
        position: relative;
        overflow: hidden;
      }

      /* The cabinet's interior light, from the top where the lamp actually is.
         This was a blue LED wash across the whole rack, which tinted every
         bottle and is why nothing in here looked like wine. */
      .grid-inner::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: radial-gradient(
          ellipse at 50% -8%,
          rgba(240, 226, 200, 0.10) 0%,
          transparent 62%
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
        background: linear-gradient(180deg, #d9c199 0%, #b0906180 60%, #6b573a 100%);
        border-radius: 0 0 2px 2px;
      }

      .cell {
        flex: 1;
        aspect-ratio: 1;
        /* The ring has to sit INSIDE the width. At content-box a 2.5px border
           adds 5px to every cell, which drew a 74 mm bottle at 79 mm and put
           five of them across 395 mm of a 430 mm shelf. */
        box-sizing: border-box;
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
        background: linear-gradient(180deg, #17151400 0%, #0a0a0a 100%), #0e0e0e;
        padding: 12px 12px 6px;
        /* A cabinet has to fit on a screen. Widths stay proportional -- that is
           the information -- but the whole drawing is capped so a rack is not
           taller than it is wide. */
        max-width: 380px;
        margin: 0 auto;
      }
      .grid-inner.to-scale::before {
        /* the cabinet's own light, from the top */
        background: radial-gradient(
          ellipse at 50% -10%,
          rgba(240, 226, 200, 0.11) 0%,
          transparent 62%
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
      /* A beech shelf, seen edge-on: the pale front rail of the slatted tray
         the bottles lie in. It is the brightest thing in the cabinet, which is
         what makes the shelves read as shelves. */
      .row.to-scale.shelf-space::after {
        content: "";
        position: absolute;
        left: -8px;
        right: -8px;
        bottom: -5px;
        height: 7px;
        border-radius: var(--wc-r-xs);
        background: linear-gradient(
          180deg,
          #f0dfc0 0%,
          #d9c199 38%,
          #b99b6d 78%,
          #7d6446 100%
        );
        box-shadow:
          0 4px 9px rgba(0, 0, 0, 0.6),
          inset 0 1px 0 rgba(255, 255, 255, 0.5);
        z-index: 3;
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

      /* ---- an empty position ---------------------------------------------
         Recessed and quiet. It contributes nothing to the row's width and must
         never read as louder than the wine. */
      /* An empty position is a MARKER, not a ghost bottle. Drawn at full
         bottle diameter it turns a sparse cabinet into a field of circles with
         the wine lost among them -- and this cabinet is mostly empty, which is
         its normal condition. Small, thin, and low contrast. */
      .row.to-scale .cell.empty {
        background: none;
        border: 1px solid rgba(214, 197, 176, 0.26);
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
      /* A free spot in the second course. Dotted rather than faded: at 0.55
         opacity over an already-faint border these were invisible, so the
         upper row looked as though it had nowhere to put anything. */
      .row.to-scale .cell.stacked.empty {
        border-style: dotted;
        border-color: rgba(214, 197, 176, 0.30);
        opacity: 1;
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
      
      .row.to-scale .cell .depth-badge {
        top: -2%;
        left: -2%;
        width: 28%;
        height: 28%;
        min-width: 12px;
        min-height: 12px;
        font-size: clamp(6px, 12cqi, 10px);
      }

      .cell.filled:hover {
        filter: brightness(1.14);
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

      /* A mostly-empty rack is the normal condition, so an empty slot has to
         stay quiet or it drowns the wine by sheer number. */
      .cell.empty {
        background: rgba(0, 0, 0, 0.22);
        border: 1px solid rgba(214, 197, 176, 0.10);
        box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.35);
      }

      .cell.empty:hover {
        background: rgba(255, 255, 255, 0.07);
        border-color: rgba(214, 197, 176, 0.34);
      }

      /* A SLOT, not a picture of a bottle.
       *
       * This is the standalone prototype's treatment, brought back after four
       * attempts at drawing an actual bottle -- a lit sphere, a shouldered
       * silhouette, a neck hanging over the rail, and a full-length bottle
       * receding into the rack. Every one of them looked worse than this, and
       * the reason is that the prototype was never illustrating a bottle. It
       * drew the SLOT: a matte hollow with a coloured ring around it. The
       * identity comes from the ring and the badges, not from a rendering.
       *
       * Matte on purpose. A specular highlight is what turns a dark circle
       * into a marble, so there is none -- the gradient is offset to 34%/30%
       * and lands on near-black, which reads as a recess rather than a bead.
       * The ring is 2.5px and the inset shadow is heavy; those two do all the
       * work.
       *
       * The wine tint is deliberately weak. At full strength every slot is a
       * saturated dot and the rack becomes a colour chart; at 12% it is just
       * enough that a red slot is not the same object as a white one. */
      .cell.filled {
        background: radial-gradient(
          circle at 34% 30%,
          color-mix(in srgb, var(--wine, #722f37) 12%, #241e1d) 0%,
          #0b0909 78%
        );
        border: 2.5px solid var(--bottle-type-color, rgba(255, 255, 255, 0.35));
        box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.75);
        overflow: hidden;
      }


      /* With no silhouette left to protect, a label photograph fills its slot
         again, inside the ring. */
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

      /* "Locate" marker: a pulsing ring drawn outside the element so it
         reads on a filled bottle, an empty slot and a box alike. */
      .locate-highlight {
        position: relative;
        z-index: 3;
        outline: 2px solid rgba(255, 193, 7, 0.9);
        outline-offset: 1px;
        animation: locatePulse 1.2s ease-in-out 3;
        border-radius: inherit;
      }

      @keyframes locatePulse {
        0%,
        100% {
          box-shadow: 0 0 0 0 rgba(255, 193, 7, 0);
          outline: 2px solid rgba(255, 193, 7, 0.9);
          outline-offset: 1px;
        }
        50% {
          box-shadow: 0 0 10px 4px rgba(255, 193, 7, 0.65);
          outline: 2px solid rgba(255, 193, 7, 1);
          outline-offset: 2px;
        }
      }

      /* Pending-Vivino-removal candidate: a steady orange ring that pulses
         for as long as the choice is active (unlike the 3-cycle locate). */
      .removal-highlight {
        position: relative;
        z-index: 3;
        outline: 2px solid rgba(255, 109, 0, 0.95);
        outline-offset: 1px;
        animation: removalPulse 1.2s ease-in-out infinite;
        border-radius: inherit;
      }

      @keyframes removalPulse {
        0%,
        100% {
          box-shadow: 0 0 0 0 rgba(255, 109, 0, 0);
        }
        50% {
          box-shadow: 0 0 10px 4px rgba(255, 109, 0, 0.65);
        }
      }

      /* The disposition used to be a disc across 65% of the cell, centred. At
         44px that IS the bottle, so a rack read as a field of blue letters
         rather than as wine. A pip on the rim: same colour, same letter, out
         of the way of the thing it is annotating. */
      .cell .disposition {
        position: absolute;
        top: auto;
        left: auto;
        /* Top corner, not bottom: the neck now hangs off the bottom of the
           cell and a pip down there sat on top of it. Smaller too -- against a
           drawn bottle rather than a plain disc it was the loudest thing in
           the rack, and it is an annotation. */
        right: -3%;
        top: -3%;
        bottom: auto;
        transform: none;
        width: 27%;
        height: 27%;
        border-radius: 50%;
        font-size: clamp(6px, 13cqi, 10px);
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        z-index: 2;
        pointer-events: none;
        line-height: 1;
        border: 1px solid rgba(0, 0, 0, 0.35);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
        opacity: 0.88;
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
        border-radius: var(--wc-r-xs);
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

      /* One pair of these sits in every empty cell of a deep rack. On a 90-slot
         cabinet that is 180 dots competing with six bottles, so an unoccupied
         depth reads as a hint rather than a mark. */
      .depth-dot.empty {
        background: none;
        border-color: rgba(255, 255, 255, 0.14);
        box-shadow: none;
      }

      .bottom-zone {
        margin-top: 8px;
        background: rgba(255, 255, 255, 0.045);
        border: 1px solid rgba(214, 197, 176, 0.16);
        border-radius: var(--wc-r-sm);
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
        font-size: var(--wc-fs-2xs);
        color: rgba(255, 255, 255, 0.6);
        width: 100%;
        text-align: center;
      }

      .zone-bottle {
        position: relative;
        width: 28px;
        height: 28px;
        border-radius: var(--wc-r-xs);
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
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(214, 197, 176, 0.18);
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
        background: linear-gradient(180deg, #d6bd93 0%, #a3855a 100%);
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
        background: linear-gradient(180deg, #c3a678 0%, #8a6f49 100%);
        border-radius: 0 0 2px 2px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-top: 1px solid rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .zone-box-shape .box-count {
        font-size: var(--wc-fs-xs);
        font-weight: 700;
        color: rgba(255, 255, 255, 0.5);
        line-height: 1;
      }

      .zone-box-item.has-wine .box-count {
        color: #fff;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
      }

      .zone-box-size {
        font-size: var(--wc-fs-2xs);
        color: rgba(255, 255, 255, 0.5);
      }

      /* Phone: tighter spacing, smaller elements */
      @media (max-width: 599px) {
        .cabinet {
          padding: 6px;
          border-radius: var(--wc-r-md);
        }
        .cabinet-name {
          font-size: var(--wc-fs-xs);
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
          font-size: var(--wc-fs-2xs);
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
              class="zone-bottle ${this._dragOverCell === bottleKey ? "drag-over" : ""} ${wine.id === this.highlightWineId ? "locate-highlight" : ""} ${this.removalHighlightIds.includes(wine.id) ? "removal-highlight" : ""}"
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
      return {
        size: boxSize,
        start,
        wineCount: boxWines.length,
        hasHighlight:
          !!this.highlightWineId && boxWines.some((w) => w.id === this.highlightWineId),
        hasRemoval:
          this.removalHighlightIds.length > 0 &&
          boxWines.some((w) => this.removalHighlightIds.includes(w.id)),
      };
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
            <div class="zone-box-item ${seg.wineCount > 0 ? "has-wine" : ""} ${seg.hasHighlight ? "locate-highlight" : ""} ${seg.hasRemoval ? "removal-highlight" : ""}">
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
          const isHighlighted =
            !!this.highlightWineId && wines.some((w) => w.id === this.highlightWineId);
          const isRemovalCandidate =
            this.removalHighlightIds.length > 0 &&
            wines.some((w) => this.removalHighlightIds.includes(w.id));
          return html`
            <div
              class="cell ${frontWine ? "filled" : "empty"} ${isDragOver ? "drag-over" : ""} ${isHighlighted ? "locate-highlight" : ""} ${isRemovalCandidate ? "removal-highlight" : ""}"
              style=${frontWine ? `--wine: ${bgColor}; --bottle-type-color: ${ringColor}` : ""}
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
    /* Locate, and the pending-Vivino-removal candidates. This path is the
       to-scale rack's, which upstream does not have -- the equivalent lines in
       _renderGridRow only mark cells in an ordinary rack, so without these a
       measured cabinet would silently fail to show what "Locate" found. */
    const isHighlighted =
      !!this.highlightWineId && wines.some((w) => w.id === this.highlightWineId);
    const isRemovalCandidate =
      this.removalHighlightIds.length > 0 &&
      wines.some((w) => this.removalHighlightIds.includes(w.id));
    /* The colour is a custom property the stylesheet builds the slot from.
       Painting a flat background here would cover it. */
    const fillStyle = frontWine
      ? `--wine: ${bgColor}; --bottle-type-color: ${ringColor};`
      : "";
    return html`
      <div
        class="cell ${frontWine ? "filled" : "empty"} ${layer === "stack" ? "stacked" : ""} ${isDragOver ? "drag-over" : ""} ${isHighlighted ? "locate-highlight" : ""} ${isRemovalCandidate ? "removal-highlight" : ""}"
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
