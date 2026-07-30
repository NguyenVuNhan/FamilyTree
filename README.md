# Family Tree

A visually premium, view-only family tree web app. Viewers explore the tree on a pan/zoom canvas — Photo | Name toggle, click-to-expand cards, print support. An admin maintains the data in a public Google Sheet; there is no backend, no auth, and no redeploy needed for data updates. The app hosts multiple families (one published sheet each), selected by a `?family=` URL parameter, and deploys to GitHub Pages via GitHub Actions, with a post-deploy smoke suite verifying the live site against bundled demo data.

## Admin guide

### Sheet format

The sheet is a **staircase outline** — exactly how a family tree is written in a Word document, one column per generation:

| Đời 1 | Đời 2 | Đời 3 | Image | PartnerImage |
|---|---|---|---|---|
| Võ Như Thôi (1932) + Nguyễn Thị Nga (1936) | | | *photo* | *photo* |
| | Võ Như Ái + Kiều Thị Nhi | | | |
| | | Võ Như Trung | | |
| | | Võ Như Sơn | | |
| | Võ Thị Ánh – Lê Văn Sinh | | | |

Rules:

- **One person (plus partner) per row, in exactly one generation column.** Write the couple in a single cell: `Name + Partner` (a `–` dash also works). Anything else in the cell — birth years like `(1932)`, alternate names — is shown as-is.
- **Children go directly under their parents, one column to the right.** A row's parent is the nearest row above it in the previous column. After finishing one branch, simply step back out to the shallower column (like Võ Thị Ánh above).
- **Generations are unlimited** — need a `Đời 9`? Just add a column. Generation column headers can say anything (`Đời 1`, `Gen 1`, …); only `Image` and `PartnerImage` are reserved names.
- **`Image` / `PartnerImage`** hold the photo for the row's person / partner (see [Image rules](#image-rules)). The `Image` column must exist (cells may be empty).
- **Do not sort the sheet** — row order *is* the family structure.
- Blank rows are fine as visual spacing.

Mistakes (a row in two columns, a child more than one step deeper than its parent) show a friendly error on the page with the exact row number — fix the sheet and refresh.

**Migrating an older sheet:** sheets using the previous ID-based format (`ID` / `FullName` / `PartnerID` / `ParentIDs` columns) no longer work and must be converted to the staircase layout above. Until converted, the page shows a sheet error (or falls back to the built-in demo data).

### Publishing your sheet

1. In Google Sheets: **File → Share → Publish to web**, format **CSV**.
2. Copy the published URL.
3. Set it as that family's `FAMILY_TREE_URL_<NAME>` repo variable (see [Adding a family](#adding-a-family) below) — one time only.
4. Subsequent sheet edits go live on page refresh — no redeploy needed.

### Image rules

The `Image` column accepts:
1. An `http(s)://…` URL
2. A `data:image/…;base64,…` URI (used as-is)
3. Raw base64 text — the format is sniffed from the header bytes and wrapped into a data URI

**Caveats:**
- Pasting a *picture* into a cell (Insert → Image in cell) does **not** survive CSV export — the cell must contain text (URL or base64 string).
- Google Sheets caps cells at 50,000 chars → base64 images must be ≤ ~35 KB (thumbnail-size). Larger images: use URLs.

To turn a photo into base64 text for the `Image` cell: use any "image to base64" web converter, copy the text output into the `Image` cell.

## Adding a family

1. Create two repo Variables (Settings → Secrets and variables → Actions → Variables) for the new family:
   - `FAMILY_TREE_URL_<NAME>` — the family's published sheet CSV URL
   - `FAMILY_TREE_NAME_<NAME>` — the human display name shown in the toolbar and page title
2. Re-run the `CI & Deploy` workflow (or push/merge to `main`) so the site rebuilds with the new family baked in.
3. Share the family's URL: `https://<owner>.github.io/<repo>/?family=<name>` (`<name>` is `<NAME>` lowercased).

The reserved `demo` family is always present. A repo variable pair named `DEMO` (`FAMILY_TREE_URL_DEMO` / `FAMILY_TREE_NAME_DEMO`) collides with it and **fails the build**.

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
- [ ] Adding a family via repo Variables end-to-end (create the two variables, re-run the workflow, open the shared URL)
