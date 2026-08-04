# Family Tree

A visually premium, view-only family tree web app. Viewers explore the tree on a pan/zoom canvas — Photo | Name toggle, click-to-expand cards, print support. An admin maintains the data in a public Google Sheet; there is no backend, no auth, and no redeploy needed for data updates. The app renders any published Google Sheet (or any CSV URL) directly from the link — no rebuild, no configuration. Open the site, paste your published-sheet link, and share the resulting URL. It deploys to GitHub Pages via GitHub Actions, with a post-deploy smoke suite verifying the live site against bundled demo data.

## Admin guide

### Sheet format

The sheet is a **staircase outline** — exactly how a family tree is written in a Word document, one column per generation:

| Đời 1 | Đời 2 | Đời 3 | Image | PartnerImage | Gender | PartnerGender |
|---|---|---|---|---|---|---|
| Võ Như Thôi (1932) + Nguyễn Thị Nga (1936) | | | *photo* | *photo* | m | f |
| | Võ Như Ái + Kiều Thị Nhi | | | | nam | nữ |
| | | Võ Như Trung | | | | |
| | | Võ Như Sơn | | | | |
| | Võ Thị Ánh – Lê Văn Sinh | | | | | |

Rules:

- **One person (plus partner) per row, in exactly one generation column.** Write the couple in a single cell: `Name + Partner` (a `–` dash also works). Add birth/death years as a trailing `(...)` on each person's own name segment, e.g. `Nguyễn Văn Trường (1928–1996) + Trần Thị Hồng Gấm (1932–2011)`. Four shapes are recognized: `(1950)` (birth only), `(1950–)` (living, birth known), `(–2001)` (death only), `(1950–2001)` (both). Anything else in the trailing parentheses — an alternate name, a nickname, non-year text — is not a year and stays part of the displayed name as-is.
- **Children go directly under their parents, one column to the right.** A row's parent is the nearest row above it in the previous column. After finishing one branch, simply step back out to the shallower column (like Võ Thị Ánh above).
- **Generations are unlimited** — need a `Đời 9`? Just add a column. Generation column headers can say anything (`Đời 1`, `Gen 1`, …); only `Image`, `PartnerImage`, `Gender`, and `PartnerGender` are reserved names.
- **`Image` / `PartnerImage`** hold the photo for the row's person / partner (see [Image rules](#image-rules)). The `Image` column must exist (cells may be empty).
- **`Gender` / `PartnerGender`** (optional columns) take `m`/`male`/`nam` or `f`/`female`/`nữ`/`nu` (case-insensitive) for the row's person / partner. Used for the illustrated placeholder avatar when a person has no image; unrecognized values fall back to the initials avatar with a warning.
- **Do not sort the sheet** — row order *is* the family structure.
- Blank rows are fine as visual spacing.

Mistakes (a row in two columns, a child more than one step deeper than its parent) show a friendly error on the page with the exact row number — fix the sheet and refresh.

**Migrating an older sheet:** sheets using the previous ID-based format (`ID` / `FullName` / `PartnerID` / `ParentIDs` columns) no longer work and must be converted to the staircase layout above. Until converted, the page shows a sheet error (no demo fallback — the error names the exact rows to fix).

### Layout settings

The gear button in the toolbar opens layout settings: card style (Classic / Circle / Photo left / Arch),
what cards show (Full / Name / Avatar), name position, placeholder style (initials or illustrated
silhouettes), connector shape, and spacing sliders. Choices are saved per family in your browser
(localStorage) and apply instantly; Reset restores the defaults.

### Print & export

The gear button's settings panel includes an **Arrangement** setting: **Top-down** (the default pan/zoom tree), **Scroll**, or **Fan**. Switching to Scroll or Fan turns on print mode and reveals the rest of the print controls:

- **Fan** lays the tree out as an Ancestral Fan: a 180° semicircle with the founding couple bottom-center and each generation forming a ring further out. Branch wedges are sized by descendant count, with a 10° minimum so small branches stay visible, and labels read outward along the radius, auto-flipping past vertical so nothing prints upside-down. A fan reads best wide and shallow — the panel hints when the current format is narrower than the recommended 2:1 landscape.

- **Theme** — four print-only visual themes, each with its own type pairing and accent color: Indochine Vintage, Nordic Minimalist, Traditional Ink Wash, Royal Botanical.
- **Format** — page-size presets A4, A3, A1, A0, Panorama (120×60 cm), Square (90×90 cm), or Custom (any size from 300mm up to 2000×1200mm).
- **Margin** — a safe margin slider, 50–70mm (default 60mm), kept clear of content on every edge.
- **Frame guide** — a toggle that overlays the page/margin frame on the canvas so you can check composition before exporting, without it appearing in the export itself.

**Export SVG** downloads a self-contained SVG of the current Scroll layout: dimensions are mm-true (SVG units equal millimeters, so the file measures correctly in any vector or print tool), all theme fonts are embedded inline (base64 `@font-face`, no external font requests), and a 100mm calibration bar is drawn in the corner so anyone opening the file can verify their viewer is rendering it at true scale. Nothing in the exported file depends on network access.

For an on-screen/paper copy instead of a file, use the browser's own **Print** (Ctrl/Cmd+P) — for large formats (A1, A0, Panorama, big Custom sizes) most browsers can't drive a physical printer at that size, so treat browser print as **Save as PDF** and send the PDF to a print shop; A4/A3 can go to a physical printer directly.

Every tree has a legibility floor — the smallest generation's names must stay readable (≥6.5mm tall, the size that's still legible from about a meter away) — so a single Scroll panorama can only fit so many people (roughly 35, depending on name lengths and tree shape) before it stops fitting. At that same 6.5mm floor, a Fan panorama holds about 3–4 descendant generations (roughly 40–90 people) — the ring layout is naturally more compact than Scroll's linear one, but deeper trees still need A0/custom sizes today, or the Panels arrangement once it lands. If the current format is too small, the panel refuses with the minimum page size the tree actually needs, so you can pick a bigger format or go Custom. Export SVG is also blocked, listing the people by name, whenever someone can't be placed at all or sits in a disconnected part of the family (not connected to the main tree) — connect or remove them first. There's no multi-page/multi-panel export yet; very large families should be split into smaller sheets, or wait for a future multi-panel arrangement.

Your share link (see [Link reference](#link-reference)) carries the arrangement, theme, format, margin, and frame-guide choices along with the rest of your layout view, so anyone opening it sees the same print setup you configured.

### Publishing and sharing your sheet

1. In Google Sheets: **File → Share → Publish to web**, format **CSV**.
2. Open the app's bare URL — a dialog asks for your link. Paste the published URL (any form works: the `pub?output=csv` link, the `pubhtml` link, or just the `2PACX-…` ID), optionally give the family a display name, and hit **View the tree**.
3. Copy the shareable link with the link button in the toolbar and send it to the family. The link is self-contained — anyone who opens it sees the tree.

   The copied link also carries your current layout view (card style, spacing, …) whenever it
   differs from the defaults, so the person opening it sees the tree exactly as you styled it.
   Their own later tweaks are saved normally — the shared view applies once, on open.
4. Subsequent sheet edits go live on page refresh — no redeploy, no configuration.

Families you have viewed successfully are remembered in your browser and offered as one-click shortcuts on the bare URL.

#### Link reference

| URL | Meaning |
|---|---|
| `?sheet=<2PACX-id>` | A published Google Sheet by its publish ID |
| `?sheet=<2PACX-id>&gid=<n>` | A specific tab of a multi-tab published sheet |
| `?src=<https CSV url>` | Any CSV file on any HTTPS host |
| `&name=<display name>` | Optional display name (toolbar heading + page title) |
| `?family=demo` | The bundled demo family |

If a shared link stops working (the panel says the sheet couldn't be loaded), the sheet was most likely unpublished — re-publish it (File → Share → Publish to web).

### Image rules

The `Image` column accepts:
1. An `http(s)://…` URL
2. A `data:image/…;base64,…` URI (used as-is)
3. Raw base64 text — the format is sniffed from the header bytes and wrapped into a data URI

**Caveats:**
- Pasting a *picture* into a cell (Insert → Image in cell) does **not** survive CSV export — the cell must contain text (URL or base64 string).
- Google Sheets caps cells at 50,000 chars → base64 images must be ≤ ~35 KB (thumbnail-size). Larger images: use URLs.

To turn a photo into base64 text for the `Image` cell: use any "image to base64" web converter, copy the text output into the `Image` cell.

## Deployment

The `CI & Deploy` workflow (`.github/workflows/ci-deploy.yml`) builds, tests, and deploys to GitHub Pages on every push to `main` (and can be re-run manually via `workflow_dispatch`).

### One-time setup

The first deploy needs GitHub Pages enabled for this repo (source: **GitHub Actions**). The workflow does this itself — the deploy job's first step (`actions/configure-pages@v4` with `enablement: true`) turns Pages on if it isn't already, so no manual dashboard step is required. Just merge to `main` and let the workflow run.

## Development

| Script | Purpose |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm test` | Run unit/component tests once |
| `npm run test:coverage` | Run tests with the v8 coverage gate (≥80% lines/branches/functions/statements) |
| `npm run test:e2e` | Run the local Playwright suite against the Vite dev server, with route-intercepted fixtures |
| `npm run test:smoke` | Run the post-deploy smoke suite against `SMOKE_BASE_URL` (real hosting, bundled demo data) |
| `npm run lint` | Type-check (`tsc -b --noEmit`) and lint (`eslint .`) |
| `npm run build` | Type-check and build for production (`dist/`) |

## Manual release checklist

Run these by hand before/after a release — they aren't automatable in CI:

- [ ] Real pinch-zoom on a physical touch device (two-pointer pinch is implemented and unit-tested; still worth confirming it feels right on real hardware)
- [ ] Real print dialog output on A4 and Letter paper, landscape orientation
- [ ] Google Sheets publish-to-web round-trip with a live sheet (edit a cell, confirm it appears on refresh with no redeploy)
- [ ] Staircase round-trip with a live sheet: add a person under a parent, refresh, confirm placement; make a deliberate depth-jump mistake, confirm the row-numbered error
- [ ] Paste-to-share round-trip with a live sheet: publish a real sheet, paste its URL into the dialog, copy the share link from the toolbar, open it in a private window, confirm the tree renders
- [ ] FOGRA39/GRACoL soft-proof of an exported SVG for each of the 4 print themes, in your print tool of choice, before a real print run
- [ ] One physical proof print per theme, checked against the soft-proof and against the on-screen theme colors
- [ ] Real print dialog (Ctrl/Cmd+P) on the Scroll arrangement at A4 and A3, checking the printed page against the on-screen frame guide
