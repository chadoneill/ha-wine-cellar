# ha-wine-cellar ("Cork Dork") — project context for Claude

Home Assistant custom integration + Lovelace card for managing a wine cellar: rack/bin layout, barcode/label scanning, Vivino enrichment, AI (Gemini) enrichment, buy list, history.

This file is about the **code**: things that were expensive to discover and are easy to get wrong again. Personal setup — deploy targets, tooling that lives on one machine, how a particular contributor likes to work — belongs in an untracked `CLAUDE.local.md`, which Claude Code reads alongside this file.

## Key technical findings (don't re-discover these)

- **Vivino's `www.vivino.com/api/explore/explore` search API silently ignores the `q` param** for unauthenticated requests — it returns the same generic "trending wines" list regardless of query (verified live, repeatedly). `search_wine()` in `vivino.py` checks the top result for basic relevance before trusting it, and falls back to HTML scraping (which *does* do real text search) when it looks wrong.
- **`api.vivino.com` (the mobile-app-facing backend) is open and unprotected** — no auth, no special headers; plain `GET https://api.vivino.com/wines/{id}` / `/vintages/{id}` / `/grapes/{id}` / `/foods` all work. Used for reliable refreshes once a wine's `vivino_id` is known (`VivinoClient.get_wine_by_id`). It has **no search endpoint** (by-id lookup only) and **no price data anywhere** — confirmed via extensive live testing: explore API, HTML scrape, real browser navigation, mobile API, even `curl` with browser-identical headers. Vivino's real price is not reliably scrapable; AI estimation (with user consent) is the fallback.
- LWIN / Liv-ex was investigated as a wine-ID/pricing source and **rejected**: the free LWIN database has no price or rating data (identification only), and Liv-ex's price data (Wine Matcher, Automation) is a professional fine-wine-trade product, not viable here.
- **A secure context is required for the live camera.** Over plain `http://`, Safari does not expose `navigator.mediaDevices` at all, so `getUserMedia` throws a `TypeError` — there is no code fix. `label-camera.ts` detects this up front and offers the file input instead, which carries `capture="environment"` and opens the native camera with no secure context needed. Ruled out and not worth re-investigating: the camera components were unchanged since v1.2.5, and the two-stage front/back photo flow (v2.9.0) was **not** the cause despite the tempting timeline match.
- **Camera errors must be told apart by `err.name`, never `err.message`.** Safari's denial message is "The request is not allowed by the user agent or the platform in the current context" — it contains neither "NotAllowed" nor "Permission", so substring matching sends every iOS failure to the generic branch. Shared helpers live in `frontend-src/src/utils/camera.ts`.
- **Barcode scanning cannot work on iOS at all**: WebKit does not implement `BarcodeDetector`. This is unrelated to http/https — even over https it reports "not supported on this browser". Unblocking it would need a WASM decoder such as zxing, which is a dependency decision nobody has taken.
- **`hass.data["lovelace_resources"]` does not exist and never has** — that wrong key is why card auto-registration silently did nothing (issue #1, "Custom element not found"). The collection lives at `hass.data[LOVELACE_DATA]` (a `LovelaceData` dataclass, `.resources`) on current HA, or a plain `hass.data["lovelace"]` dict on older ones. Two traps around it: `async_items()` does **not** load the store (`ResourceStorageCollection` defers until a write), so an existence check reads empty and duplicates the resource on every restart — call `_async_ensure_loaded()` first; and YAML-mode dashboards have no `async_create_item` at all, so registration is impossible there by design and should be explained rather than attempted.
- **Which add path calls what**: barcode hit ⇒ Vivino only; barcode miss ⇒ falls through to the label; label photo ⇒ AI, *plus* a non-blocking Vivino lookup fired once the details step opens; search by name ⇒ Vivino only. The label path used to skip Vivino entirely, so photo-added wines had no rating and **no `vivino_id`**, which also barred them from the cheap by-id refresh. The background enrichment only fills gaps — it never overwrites the AI's reading, the user's photo, or name/winery/vintage — and it verifies the candidate really is the same wine, because Vivino answers every query with *something*.
- **Vivino latency, measured with production headers**: the explore API takes 1.1–1.7 s and returns **~910 KB** for five results; grape lookups are 0.06–0.2 s each. AI label recognition is a single call, no retry, 45 s timeout — that wait belongs to the provider, so there is nothing to optimise locally beyond not lengthening it. Independent requests run concurrently (`search_wine`'s explore + HTML, `lookup_barcode`'s two barcode DBs, grape names). **`fetch_extras=False` must stay sequential** — that flag exists so batch refresh does not double its request volume across the whole cellar.
- **Occupancy and placement math is shared, not re-derived**: `frontend-src/src/utils/location.ts` owns the notion of a *container* (a bin, a box, the bottom zone, or one grid slot with its depth) plus usage, labels, next-free-depth and multi-bottle planning. `utils/suggest.ts` (where a new bottle should go) and `utils/arrange.ts` (what is untidy) both build on it. It previously existed in four diverging private copies.
- **Photos live on disk, not in the records.** They used to be base64 `data:` URLs inside each wine, so a cellar entered by photo shipped megabytes over the websocket on every load and again after every edit. `photos.py` writes them to `<config>/wine_cellar_photos/` and the wine keeps a short URL. Filenames are built server-side (`{safe_id}-{side}-{stamp}.{ext}`, wine id stripped to `[A-Za-z0-9_-]`), so nothing from the client reaches the filesystem, and the stamp makes replacement cache-safe. `prune()` deletes only files that no wine **and no history entry** still references, and is skipped entirely unless storage actually loaded from disk. Backups are the deliberate exception: `inline_for_backup()` re-inlines them so a backup stays self-contained.

## Build and verify

- Frontend is TypeScript/Lit in `frontend-src/src/`, built with `npm run build` (from `frontend-src/`) into `custom_components/wine_cellar/frontend/wine-cellar-card.js`. After any frontend change, bump `FRONTEND_VERSION` in `custom_components/wine_cellar/const.py` (`YYYYMMDD` + an incrementing letter) to bust the browser cache.
- Verification without a live Home Assistant: `npm run build` (**warning-free** — a new warning is a real finding, not background noise), `node --check` on the compiled bundle, and `python3 -c "import ast; ast.parse(...)"` per changed `.py` file.
- **Local frontend preview**: `custom_components/wine_cellar/frontend/index.html` is a standalone page with a full mock `hass` object — `callWS` is mocked for every command the card uses, so no backend is needed. `.claude/launch.json` defines `preview-server` (`python3 -m http.server 5051` in the frontend dir), which serves it against the last `npm run build`; `frontend-dev` (`npm run dev`, port 5050) is rollup watch only. **The preview caches hard: `location.reload()` will happily re-run the previous bundle** — force a reload after rebuilding, and confirm something you just changed is actually present before concluding a fix does not work. It includes a "Capacity Test" cabinet (a Bulk Bin already at capacity plus a Spare Bin) for exercising the bin/box capacity logic. For a case the mock does not cover, a synthetic DOM `drop` event with a hand-built `dataTransfer` payload matching what `cabinet-grid.ts` produces exercises `_onWineDrop` deterministically, without fighting mouse-coordinate simulation.
- A compiled bundle is a build artifact: when it conflicts in a merge, **rebuild it** rather than taking either side. A bundle picked from one side no longer matches its sources.

## CI notes

- **`hacs/action` resolves the repository by branch name**, so any run whose branch disappears under it dies with "Not Found" → "Repository … not loaded properly in HACS". That is a missing ref, never a regression, and it hits original runs as much as reruns: merging with `--delete-branch` while validation is still in flight kills it within seconds. **Let a PR's checks finish before deleting its branch.**
- `on: push` is scoped to `main` so a PR branch does not run the suite twice; branch coverage comes from `on: pull_request`.
- HACS validation also checks two repository *settings* rather than anything in the tree: Issues must be enabled, and the repository needs topics. GitHub creates forks with both missing, which fails two of the nine checks until they are set.
- The "does not contain brands assets … falling back to the brands repository" line is informational, not a failed check.

## Where to look

- `custom_components/wine_cellar/vivino.py` — Vivino explore API, HTML scrape, mobile API (`api.vivino.com`), barcode lookup.
- `custom_components/wine_cellar/vivino_account.py` / `vivino_reconcile.py` — optional Vivino *account* sync: session-cookie client, three-way reconciliation, write-back.
- `custom_components/wine_cellar/gemini.py` — AI (Gemini / OpenAI-compatible) enrichment, label recognition, wine list extraction.
- `custom_components/wine_cellar/photos.py` — bottle photos on disk, the served URL, backup inlining, pruning.
- `custom_components/wine_cellar/websocket.py` — all frontend↔backend commands; most business logic (refresh, batch refresh, settings, backup/restore) lives here.
- `custom_components/wine_cellar/wine_storage.py` — persisted data shape (`.storage/wine_cellar`), the Wine/Cabinet/BuyList schema.
- `frontend-src/src/wine-cellar-card.ts` — main card (grid, tabs, batch actions, stats).
- `frontend-src/src/components/` — dialogs (wine detail, add wine, inventory, rack settings, Vivino/AI settings, wine list scan, arrangement report).
- `frontend-src/src/utils/` — shared logic, extracted so it stops being copied: `location.ts` (containers, occupancy, placement), `suggest.ts` (where a new bottle should go), `arrange.ts` (what is untidy), `search.ts` (`normalizeText`, filtering, sorting), `camera.ts` (why the camera failed).

## Deploying a change

There is no CI/CD here. A change reaches a running Home Assistant by copying the changed `.py` files plus the compiled frontend JS into `custom_components/wine_cellar/`, then doing a **full Home Assistant restart** — reloading the integration is not enough, because Python caches modules.

**Then hard-refresh the browser tab.** The Home Assistant frontend is a persistent single-page app: restarting the backend does not reload an already-open tab's JavaScript. Two separate "the fix still doesn't work" reports on this project turned out to be exactly this — the fix was correct both times, the tab had simply not picked it up.

For HACS installs, "update available" is driven by GitHub **Releases**, not by commits on `main`. Merging a PR alone reaches nobody; it takes a bumped `manifest.json` version plus a published release.

---

# This fork: real bottle geometry

Everything below is specific to the `real-bottle-geometry` fork
(`chadoneill/ha-wine-cellar`) and is not in upstream. It is appended after
upstream's content on purpose: keeping the two apart means a future
`git merge upstream/main` conflicts in as few places as possible.

## Remotes

- `upstream` = `BaconWappedBitcoin/ha-wine-cellar`. **Read-only.** Do not push,
  open PRs, or comment there without explicit per-action confirmation.
- `origin` = `chadoneill/ha-wine-cellar`, the fork. Work happens on
  `real-bottle-geometry`.

## What this fork adds

`frontend-src/src/geometry.ts` — bottle dimensions and row packing. Pure,
dependency-free, pinned by 51 tests in `frontend-src/test/geometry.test.ts`.

It is **opt-in and backward compatible**. A cabinet with no
`internal_width_mm` renders exactly as upstream does, as equal cells, and none
of the geometry code runs. Set the measured internal width and the same rack is
drawn to scale instead.

Two rules make a scale drawing honest, and both are easy to get wrong:

1. **An empty position contributes ZERO width.** Model it at the nominal pitch
   and it becomes the fattest object in the row — 86 mm against a Bordeaux's
   76 — so a sparse cabinet draws its empty slots larger than its wine. The
   empty ring is drawn at a fixed 76 mm reference on the leftover pitch.
2. **An over-capacity row must visibly overflow.** Normalising it back to the
   shelf width makes five Champagnes in a 430 mm shelf render identically to an
   empty shelf, which is the one case the drawing exists to shout about. The
   scale is always `100 / span`, never `100 / max(span, wanted)`.

`bordeaux_heavy` exists at 85 mm because premium heavy glass — Grange, Hill of
Grace, Sassicaia, most serious Barossa Shiraz — runs 82–88, not the nominal 76.
Nine millimetres a bottle is the difference between a row that looks crowded
and one that looks roomy, and seeing that is the whole point.

**The drawing never reports fit.** No free-space figures, no "over by N mm", no
commentary of any kind. An over-capacity row simply runs past the shelf edge
and is seen doing it.

### The reference cabinet, measured

A Vintec 35, photographed and measured by the owner: **155 mm between
shelves** (half-step adjustment available), bottles **about 74 mm across**,
**430 mm internal width**. Shelves are pale beech slatted trays with a solid
front rail in a black interior — the beech is the brightest thing in the
cabinet, which is what makes a shelf read as a shelf.

Bottles lie lengthways, necks to the front. At 155 mm of gap a nested second
course needs about 138 mm, so it fits — but not over a magnum.

This is a drawing, not a CAD model. It will never be exactly right.

### Stacking is a different axis from depth

Upstream's `depth` is front-to-back into the rack. This fork's `layer` is a
second course nested in the **valleys on top** of the first, which is how a
wine fridge's shelves actually work. They are orthogonal; a cabinet can have
both. A wine with no `layer` is in the base row, where every bottle created
before this existed lives.

`cabinet_capacity` counts a stacked shelf's second course: one fewer than the
shelf beneath, and those slots are real.

### A slot, not a picture of a bottle

`.cell.filled` is a matte hollow with a coloured ring — the treatment from the
standalone prototype this geometry came from:

```
background: radial-gradient(circle at 34% 30%, <weak wine tint>, #0b0909 78%);
border: 2.5px solid var(--bottle-type-color);
box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.75);
```

**Do not try to draw a bottle in it.** Four attempts were built and rejected: a
lit sphere (a marble by definition); a shouldered silhouette squashed into the
cell (a lampshade); the neck hanging below the cell over the front rail, which
is physically right and reads as the bottle *falling out of the cabinet*; and a
full-length bottle receding into the rack, which is the most literally correct
and the worst-looking — the bottles dissolve into pale plumes and swallow the
empty placeholders. Drawing the shelf surface behind them was tried too; the
placeholders are a faint cream ring tuned against black and vanish against lit
wood.

The lesson: the prototype was never illustrating a bottle, it was drawing the
**slot**. Identity comes from the ring and the badges. Matte on purpose — a
specular highlight is exactly what turns a dark circle into a marble.

**`.cell` must stay `box-sizing: border-box`.** At content-box the 2.5px ring
adds 5px to every cell, which drew a 74 mm bottle at 79 mm and put five of them
across 395 mm of a 430 mm shelf.

What must stay true: every `.cell.filled` box measures square and equal to the
bottle's base width, and every to-scale row measures `shelf_height_mm` at the
row's own `internal_width_mm` scale.

## Design tokens

`src/styles.ts` defines the type scale, weights, radii and spacing on `:host`.
**Do not add a bare `font-size` in `em` or a raw `border-radius` in px.**

The app had twenty-odd font sizes, almost all fractional `em`; the commonest
was `0.8em`, used 37 times. Because `em` compounds, an `0.8` inside an `0.85`
lands near 11px, so text shrank the deeper it was nested. The scale is
absolute: `--wc-fs-2xs` (11px) through `--wc-fs-2xl` (22px).

This is the most opinionated part of the fork and the least likely to be
welcome upstream, where another contributor is restyling the same files.

## Where the fork's fields are set and stored

| Field | Set in | Stored by |
|---|---|---|
| `internal_width_mm`, `shelf_height_mm`, `stacked_rows` | Manage Racks → Edit | `add_cabinet` / `update_cabinet` |
| `shape`, `format_ml` | Add Wine, and the wine editor | `add_wine` / `update_wine` |
| `base_width_mm` | the wine editor | as above |
| `layer` | drag and drop | `move_wine`, over the websocket |

`update_wine` and `update_cabinet` copy any key they are given, so only
`add_wine` and `add_cabinet` — which build an explicit dict — needed changing.

## Verify with `npm run verify`, not `npm run build`

This fork adds `verify` = typecheck, then tests, then build. Rollup's
TypeScript plugin reports type errors as *warnings* and emits the bundle
regardless, which shipped a `ReferenceError` here once. `tsc --noEmit` is
clean, so any error is one you just made.

## Two traps in this component that have each bitten more than once

**Never leave `width`/`height` as `auto` on an `<img>` positioned with insets.**
An image is a *replaced* element: `width: auto` resolves to its **intrinsic**
size and the opposing inset is dropped as over-constrained. `.wine-thumb` was
`inset: 32%; width: auto; height: auto`, so a 375×500 Vivino photo rendered at
375×500 inside a 65 px cell — 5.7× too wide, covering two thirds of the rack,
spilling everywhere because a to-scale cell has `overflow: visible` by design.
It hid for weeks because it needs a photo that actually **loads**: a broken
image has zero intrinsic size and looks perfect. The preview harness's
to-scale cabinet now carries one wine with a `data:` URI photo that resolves
offline, so this path is exercised without a network.

**Backticks inside a `css` template literal terminate it.** Writing
`` `width: auto` `` in a CSS comment produces a wall of `TS1005: ',' expected`
that points at the CSS, not at the comment. This has happened three times. Use
plain text in comments inside `css` and `html` tagged templates.
