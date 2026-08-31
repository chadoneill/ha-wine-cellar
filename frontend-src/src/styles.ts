import { css } from "lit";

export const sharedStyles = css`
  :host {
    --wc-primary: #7b333c;
    --wc-primary-light: #9a4a54;
    --wc-primary-text: #c48b91;
    --wc-accent: #c69749;
    --wc-bg: var(--ha-card-background, var(--card-background-color, #fff));
    --wc-surface: var(--ha-card-background, var(--card-background-color, #fff));
    --wc-text: var(--primary-text-color, #212121);
    --wc-text-secondary: var(--secondary-text-color, #727272);
    --wc-border: var(--divider-color, #e0e0e0);
    --wc-shadow: var(--ha-card-box-shadow, 0 2px 6px rgba(0, 0, 0, 0.1));
    --wc-hover: rgba(128, 128, 128, 0.12);

    /* ---- type scale -------------------------------------------------------
       Absolute, not em. Every size in this app used to be a fraction of its
       parent -- 0.8em was the single commonest value, used 37 times -- and
       because em compounds, an 0.8 inside an 0.85 landed at about 11px. That
       is what made the whole thing look shrunken and soft. These are fixed
       steps, so a label is the same size wherever it appears. */
    --wc-fs-2xs: 11px;
    --wc-fs-xs: 12px;
    --wc-fs-sm: 13px;
    --wc-fs-md: 14px;
    --wc-fs-lg: 15px;
    --wc-fs-xl: 18px;
    --wc-fs-2xl: 22px;

    --wc-fw-normal: 400;
    --wc-fw-medium: 500;
    --wc-fw-semi: 600;
    --wc-fw-bold: 700;

    /* ---- corner radii, four steps instead of nine ad-hoc values ---- */
    --wc-r-xs: 5px;
    --wc-r-sm: 9px;
    --wc-r-md: 13px;
    --wc-r-lg: 18px;
    --wc-r-pill: 999px;

    /* ---- spacing rhythm ---- */
    --wc-sp-1: 4px;
    --wc-sp-2: 8px;
    --wc-sp-3: 12px;
    --wc-sp-4: 16px;
    --wc-sp-5: 24px;

    font-family: var(
      --paper-font-body1_-_font-family,
      ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI Variable Text",
      "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif
    );
    font-size: var(--wc-fs-md);
    line-height: 1.45;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Figures line up in columns and do not jitter as they change. */
  .stat-value,
  .num,
  .stepper-value,
  .stepper-val-sm {
    font-variant-numeric: tabular-nums;
    font-feature-settings: "tnum" 1;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--wc-sp-4) var(--wc-sp-4) var(--wc-sp-2);
    font-size: var(--wc-fs-2xl);
    font-weight: var(--wc-fw-semi);
    letter-spacing: -0.015em;
    color: var(--wc-text);
  }

  .card-content {
    padding: 16px;
  }

  .stats-bar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--wc-sp-2) var(--wc-sp-5);
    padding: var(--wc-sp-1) var(--wc-sp-4) var(--wc-sp-3);
    font-size: var(--wc-fs-sm);
    color: var(--wc-text-secondary);
  }

  .stats-bar .stat {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .stats-bar .stat-value {
    font-weight: var(--wc-fw-semi);
    font-size: var(--wc-fs-lg);
    letter-spacing: -0.01em;
    color: var(--wc-text);
  }

  .tab-bar {
    display: flex;
    gap: var(--wc-sp-2);
    padding: var(--wc-sp-1) var(--wc-sp-4) var(--wc-sp-3);
    overflow-x: auto;
    /* A flex/grid item defaults to min-width:auto, so this scroller was sized
       by its content and pushed the whole PAGE sideways instead of scrolling
       within itself. */
    min-width: 0;
    max-width: 100%;
    scrollbar-width: none;
    border-bottom: 1px solid var(--wc-border);
    /* The bar scrolls, and it was simply cut off at the right edge with no
       sign that there was more. Fade the ends so the overflow is legible, and
       let a swipe settle on a tab rather than mid-tab. */
    scroll-snap-type: x proximity;
    -webkit-mask-image: linear-gradient(
      90deg,
      transparent 0,
      #000 18px,
      #000 calc(100% - 26px),
      transparent 100%
    );
    mask-image: linear-gradient(
      90deg,
      transparent 0,
      #000 18px,
      #000 calc(100% - 26px),
      transparent 100%
    );
  }
  .tab-bar > * {
    scroll-snap-align: start;
  }
  .tab-bar::-webkit-scrollbar {
    display: none;
  }

  .tab {
    flex: 0 0 auto;
    padding: 7px 14px;
    min-height: 34px;
    border-radius: var(--wc-r-pill);
    border: 1px solid transparent;
    background: var(--wc-hover);
    color: var(--wc-text-secondary);
    cursor: pointer;
    white-space: nowrap;
    font-size: var(--wc-fs-sm);
    font-weight: var(--wc-fw-medium);
    transition: background 0.15s ease, color 0.15s ease;
  }

  .tab:hover {
    background: var(--wc-hover);
  }

  .tab.active {
    background: var(--wc-primary);
    color: #fff;
    border-color: transparent;
    font-weight: var(--wc-fw-semi);
  }

  .manage-racks-btn {
    margin-left: auto;
    border-color: transparent;
    color: var(--wc-primary-text);
    font-weight: 500;
    font-size: var(--wc-fs-sm);
    padding: 6px 12px;
  }

  .manage-racks-btn:hover {
    background: var(--wc-hover);
  }

  /* Sits right after .manage-racks-btn with the tab-bar's normal gap — no
     margin-left: auto of its own, or it would claim the remaining space and
     drift away from it instead of staying grouped together. */
  .settings-tab-btn {
    border-color: transparent;
    color: var(--wc-primary-text);
    font-weight: 500;
    font-size: var(--wc-fs-sm);
    padding: 6px 12px;
  }

  .settings-tab-btn:hover {
    background: var(--wc-hover);
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--wc-sp-2);
    padding: 0 16px;
    /* a real tap target: 36px was the effective height before, and on a phone
       that is a miss waiting to happen */
    min-height: 38px;
    border-radius: var(--wc-r-sm);
    border: 1px solid transparent;
    cursor: pointer;
    font-family: inherit;
    font-size: var(--wc-fs-sm);
    font-weight: var(--wc-fw-medium);
    letter-spacing: 0.005em;
    white-space: nowrap;
    transition: background 0.15s ease, border-color 0.15s ease, transform 0.08s ease;
  }
  .btn:active {
    transform: translateY(1px);
  }
  .btn:focus-visible {
    outline: 2px solid var(--wc-accent);
    outline-offset: 2px;
  }

  .btn-primary {
    background: var(--wc-primary);
    color: #fff;
  }

  .btn-primary:hover {
    background: var(--wc-primary-light);
  }

  /* Tonal action button: a wash of its own colour rather than a saturated
     fill. Five solid pills in a row -- blue, purple, teal, slate, red -- read
     as a toolbar from a decade ago and shout over the wine, which is the thing
     the page is actually about. The colour still identifies the action; it
     just stops competing. Pass the colour as --tint. */
  .btn-tonal {
    background: color-mix(in srgb, var(--tint, var(--wc-primary)) 16%, transparent);
    border-color: color-mix(in srgb, var(--tint, var(--wc-primary)) 38%, transparent);
    color: var(--wc-text);
  }
  .btn-tonal:hover {
    background: color-mix(in srgb, var(--tint, var(--wc-primary)) 26%, transparent);
    border-color: color-mix(in srgb, var(--tint, var(--wc-primary)) 55%, transparent);
  }
  .btn-tonal[disabled] {
    opacity: 0.45;
    cursor: default;
  }

  .btn-outline {
    background: transparent;
    color: var(--wc-text);
    border-color: var(--wc-border);
  }

  .btn-outline:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .btn-icon {
    background: transparent;
    border: none;
    color: var(--wc-text-secondary);
    cursor: pointer;
    padding: 8px;
    min-width: 38px;
    min-height: 38px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .btn-icon:hover {
    background: var(--wc-hover);
  }

  .dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
    animation: fadeIn 0.2s ease;
  }

  .dialog {
    background: var(--wc-bg);
    border-radius: var(--wc-r-lg);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.24);
    max-width: 500px;
    width: 90%;
    max-height: 85vh;
    overflow-y: auto;
    animation: slideUp 0.3s ease;
    /* user-select is inherited, so it crosses the Shadow DOM boundary from
       whatever wraps this card (e.g. Home Assistant's dashboard drag-reorder
       chrome) — re-declare it explicitly so dialog text stays selectable
       regardless of what the host page sets. */
    user-select: text;
    -webkit-user-select: text;
    -webkit-touch-callout: default;
  }

  .dialog-header {
    padding: 20px 20px 12px;
    font-size: var(--wc-fs-xl);
    font-weight: 500;
    border-bottom: 1px solid var(--wc-border);
  }

  .dialog-body {
    padding: 16px 20px;
  }

  .dialog-footer {
    padding: 12px 20px 20px;
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: block;
    font-size: var(--wc-fs-md);
    font-weight: 500;
    color: var(--wc-text-secondary);
    margin-bottom: 4px;
  }

  .form-group input,
  .form-group select,
  .form-group textarea {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--wc-border);
    border-radius: var(--wc-r-sm);
    font-size: var(--wc-fs-lg);
    background: var(--wc-bg);
    color: var(--wc-text);
    box-sizing: border-box;
  }

  .form-group textarea {
    min-height: 60px;
    resize: vertical;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  /* Phone: full-screen dialogs, compact forms */
  @media (max-width: 599px) {
    .dialog {
      width: 100%;
      max-width: 100%;
      max-height: 100vh;
      border-radius: 12px 12px 0 0;
      margin-top: auto;
    }
    .dialog-overlay {
      align-items: flex-end;
    }
    .dialog-header {
      padding: 16px 16px 10px;
      font-size: var(--wc-fs-xl);
    }
    .dialog-body {
      padding: 12px 16px;
    }
    .dialog-footer {
      padding: 10px 16px 16px;
    }
    .form-row {
      grid-template-columns: 1fr;
      gap: 8px;
    }
    .tab-bar {
      padding: 6px 12px;
      gap: 3px;
    }
    .tab {
      padding: 5px 12px;
      font-size: var(--wc-fs-sm);
    }
    .depth-panel {
      width: 100% !important;
      border-radius: 0 !important;
    }
  }

  /* --- Depth Side Panel --- */
  .depth-panel-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 99;
    animation: fadeIn 0.2s ease;
  }

  /* While dragging a wine out of the panel, let the backdrop pass drag/drop
     events through to the racks behind it instead of swallowing them. */
  .depth-panel-backdrop.drag-through {
    pointer-events: none;
  }

  .depth-panel {
    position: fixed;
    right: 0;
    top: 0;
    bottom: 0;
    width: 300px;
    background: var(--wc-bg);
    z-index: 100;
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    transform: translateX(100%);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    overflow-y: auto;
  }

  .depth-panel.open {
    transform: translateX(0);
  }

  .depth-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid var(--wc-border, #e0e0e0);
    flex-shrink: 0;
  }

  .depth-panel-title {
    font-weight: 600;
    font-size: var(--wc-fs-lg);
    color: var(--wc-text, #333);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .depth-panel-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .depth-panel-sort {
    background: none;
    border: 1px solid var(--wc-border, #ddd);
    border-radius: 12px;
    color: var(--wc-text-secondary, #888);
    cursor: pointer;
    font-size: 0.72em;
    padding: 4px 9px;
    white-space: nowrap;
  }

  .depth-panel-sort:hover:not(:disabled) {
    border-color: var(--wc-primary, #722f37);
    color: var(--wc-primary, #722f37);
  }

  .depth-panel-sort:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .depth-panel-confirm {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0 12px 8px;
    padding: 10px 12px;
    border: 1px solid #c98a00;
    border-radius: 8px;
    background: rgba(201, 138, 0, 0.08);
    font-size: 0.76em;
    color: var(--wc-text-secondary, #888);
    line-height: 1.4;
  }

  .depth-panel-confirm strong {
    color: var(--wc-text, #333);
  }

  .depth-panel-confirm-btns {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 2px;
  }

  .depth-panel-confirm-btns button {
    background: none;
    border: 1px solid var(--wc-border, #ddd);
    border-radius: 8px;
    color: var(--wc-text-secondary, #888);
    cursor: pointer;
    font-size: 1em;
    padding: 5px 12px;
  }

  .depth-panel-confirm-btns button.primary {
    background: var(--wc-primary, #722f37);
    border-color: var(--wc-primary, #722f37);
    color: #fff;
    font-weight: 600;
  }

  .depth-panel-rack {
    font-size: 0.78em;
    font-weight: 500;
    color: var(--wc-text-secondary, #888);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .depth-panel-subtitle {
    font-size: var(--wc-fs-sm);
    font-weight: 400;
    color: var(--wc-text-secondary, #888);
  }

  .depth-panel-close {
    background: none;
    border: none;
    font-size: var(--wc-fs-xl);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: var(--wc-r-sm);
    color: var(--wc-text-secondary, #888);
  }

  .depth-panel-close:hover {
    background: var(--wc-hover);
  }

  .depth-panel-slots {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .depth-slot {
    position: relative;
    border-radius: var(--wc-r-md);
    cursor: pointer;
    transition: background 0.15s, box-shadow 0.15s;
  }

  .depth-slot:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .depth-slot.drag-over {
    box-shadow: 0 0 0 2px rgba(66, 165, 245, 0.8);
    background: rgba(66, 165, 245, 0.15);
  }

  .depth-slot.highlight {
    box-shadow: 0 0 0 2px rgba(196, 139, 145, 0.9);
    animation: highlightPulse 1.2s ease-in-out 3;
  }

  @keyframes highlightPulse {
    0%, 100% { box-shadow: 0 0 0 2px rgba(196, 139, 145, 0.9); }
    50% { box-shadow: 0 0 0 5px rgba(196, 139, 145, 0.4); }
  }

  .depth-slot-delete {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--wc-fs-sm);
    line-height: 1;
    color: var(--wc-text-secondary, #888);
    background: rgba(0, 0, 0, 0.06);
    z-index: 3;
  }

  .depth-slot-delete:hover {
    background: #c62828;
    color: #fff;
  }

  .depth-panel-add-box {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }

  .depth-panel-add-box select {
    flex: 1;
    padding: 8px 10px;
    border-radius: var(--wc-r-sm);
    border: 1px solid var(--wc-border, #ddd);
    background: var(--wc-bg);
    color: var(--wc-text, #333);
    font-size: var(--wc-fs-md);
  }

  .depth-panel-add-box .depth-panel-grow {
    flex-shrink: 0;
    padding: 8px 14px;
    margin-top: 0;
  }

  .depth-slot-label {
    font-size: var(--wc-fs-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--wc-text-secondary, #888);
    padding: 0 4px 4px;
  }

  .depth-slot-wine {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: var(--wc-bg);
    border: 1px solid var(--wc-border);
    border-radius: var(--wc-r-md);
  }

  .depth-slot-avatar {
    position: relative;
    flex-shrink: 0;
  }

  .depth-slot-thumb {
    width: 32px;
    height: 44px;
    border-radius: var(--wc-r-xs);
    object-fit: cover;
    flex-shrink: 0;
  }

  .depth-slot-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .depth-slot-disposition {
    position: absolute;
    bottom: -3px;
    right: -4px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    font-size: 8px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    border: 1.5px solid var(--wc-bg, #fff);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    line-height: 1;
  }

  .depth-slot-disposition.drink {
    background: #2e7d32;
  }

  .depth-slot-disposition.hold {
    background: #1565c0;
  }

  .depth-slot-disposition.past {
    background: #c62828;
  }

  .depth-slot-info {
    flex: 1;
    min-width: 0;
  }

  .depth-slot-name {
    font-weight: 600;
    font-size: var(--wc-fs-md);
    color: var(--wc-text, #333);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .depth-slot-meta {
    font-size: var(--wc-fs-sm);
    color: var(--wc-text-secondary, #888);
    margin-top: 2px;
  }

  .depth-slot-empty {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 12px;
    border: 2px dashed var(--wc-border, #ddd);
    border-radius: var(--wc-r-md);
    color: var(--wc-text-secondary, #aaa);
    font-size: var(--wc-fs-md);
  }

  .depth-slot.empty:hover .depth-slot-empty {
    border-color: var(--wc-primary-text);
    color: var(--wc-primary-text);
  }

  .depth-slot-plus {
    font-size: var(--wc-fs-2xl);
    font-weight: 300;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--wc-hover);
  }

  .depth-slot.empty:hover .depth-slot-plus {
    background: rgba(196, 139, 145, 0.2);
  }

  .depth-panel-grow {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px;
    margin-top: 4px;
    border-radius: var(--wc-r-md);
    border: 1px dashed var(--wc-border, #ddd);
    color: var(--wc-text-secondary, #888);
    cursor: pointer;
    font-size: var(--wc-fs-md);
    font-weight: 600;
    transition: background 0.15s, color 0.15s;
  }

  .depth-panel-grow:hover {
    border-color: var(--wc-primary-text);
    color: var(--wc-primary-text);
  }
`;
