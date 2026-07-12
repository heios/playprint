# Spec: Playful Cut-Out Card Template Generator

> Status: `ready-for-agent`
> Type: Product spec (PRD)
> Delivered as a Markdown file because this project is not yet a git repository / has no
> issue tracker. When a tracker exists, file this as an issue and apply the `ready-for-agent` label.

---

## Problem Statement

A parent or teacher wants to make a children's craft like the "Today is…" standing calendar
(see `_references/` — the SDL "Fun project: A calendar" workbook and photos): a set of **month
word-cards** and **date digit-cards** that a small child cuts out along a border, colours in, and
mounts on a coloured paper backing, then stands up in a little folded calendar.

Making these by hand is tedious and inconsistent, and the results look flat. Specifically, the
maker struggles with:

- Hand-drawing 12 month names (plus digit cards) with even, cuttable borders — slow and uneven.
- Getting a **playful, toy-like** look (wobbly letters, tilted cards, a coloured mat behind each
  card) rather than a rigid word-processor grid.
- Fitting everything onto printable pages at a **real, known physical size** so the cut-out cards
  are the size the child needs.
- Needing **duplicate digits** (two "1"s, two "2"s, …) to compose dates like `11` or `22` from
  single-digit cards.
- Producing the **two layers** of the matted craft — the inner card with the word, and the
  slightly larger coloured backing behind it — as separate printable sheets that line up.
- Iterating: there is no fast way to try "a bit more wobble", "a slightly bigger mat", "a different
  friendly font" and see the effect immediately.

## Solution

A single **static HTML page** (publishable to github.io, no server) that generates playful
cut-out card templates and exports them as a **multi-page PDF**.

From the maker's perspective:

- They type or pick a set of **words** (a **Months** preset, a **Digits** preset, or any custom
  text). Every whitespace-separated **token** becomes one bordered **card**; duplicates are just
  repeated tokens, so `1 1 2 2` yields the duplicate digit cards they need.
- Every card is drawn with a friendly handwriting font (Comic Neue by default; a picker with more
  fonts, including any Google Font), a cut-line **border**, and optional **playful** touches:
  wobbly/flowing letters and gently tilted, offset cards — so the page already looks like a toy
  before a single cut is made.
- They can add a **second, larger border** (a coloured **mat**) behind each card, and print the two
  layers separately for the classic matted-craft look.
- Everything is driven by **live sliders and toggles**; dragging a slider **continuously morphs**
  the result (never jumps), so the maker can dial it in "just right". A separate **Randomize**
  control is the only thing that reshuffles.
- They choose a **paper size** (full ISO A0–A10 and B0–B10, plus US Letter/Legal/Tabloid) and
  orientation; content **flows onto as many pages as needed**.
- A **main preview** shows the actual paginated sheets (zoomable); a **second preview** shows one
  card enlarged inside the top third of the chosen page for close inspection.
- Work is saved as named **projects in the browser** and can be **shared by URL** (all settings
  encoded in the link).

## User Stories

Actors: **Maker** (parent/teacher operating the tool), **Child** (end user of the printed cards).

**Content**

1. As a Maker, I want a text box where I type words, so that each word becomes its own cut-out card.
2. As a Maker, I want tokens split on whitespace, so that I control exactly which words become cards.
3. As a Maker, I want to repeat a token (e.g. `1 1`), so that I get duplicate cards to build dates like `11` and `22`.
4. As a Maker, I want a **Months** preset button, so that I can fill the box with `January … December` in one click.
5. As a Maker, I want a **Digits** preset button that fills `0 1 1 2 2 3 4 5 6 7 8 9`, so that I get a ready digit kit with the duplicates dates need.
6. As a Maker, I want to freely edit any preset after inserting it, so that I can adjust the exact multiset of cards.
7. As a Maker, I want **newlines** in my text to force row breaks, so that I can arrange cards into a shaped, "funny-looking" message.
8. As a Maker, I want a **blank line** to create an empty row, so that I can add vertical spacing in that arrangement.
9. As a Maker, I want a single long line to soft-wrap onto the next row when it's wider than the page, so that nothing runs off the sheet.

**Cards & sizing**

10. As a Maker, I want every card the **same size** (uniform mode), so that months look tidy and aligned.
11. As a Maker, I want an option for each card to **hug its own content** (fit mode), so that a single letter "a" isn't blown up to the size of "strawberry".
12. As a Maker, I want card **height** to stay uniform even in fit mode, so that a row of mixed-width cards still lines up.
13. As a Maker, I want a **padding** control between the word and its border, so that letters have breathing room inside the cut line.
14. As a Maker, I want the border to **auto-grow** so no playfully-rotated letter ever crosses the cut line, so that the word is never clipped when cut out.
15. As a Maker, I want a **gap** control between neighbouring cards, so that I can space them for easy cutting.

**Borders, mat & the two-layer craft**

16. As a Maker, I want a rectangular **border** around each word, so that the child has a clear line to cut along.
17. As a Maker, I want to set the **border colour** and **stroke width**, so that the cut line matches my craft.
18. As a Maker, I want a **corner radius** control, so that I can choose sharp or rounded cards.
19. As a Maker, I want to **turn the border off**, so that I can make a purely decorative poster with no cut line.
20. As a Maker, I want an optional **second (outer) border** — a mat — behind each card, so that I can mount the inner card on a coloured backing.
21. As a Maker, I want the second border's controls to **appear only when enabled**, so that the panel stays uncluttered.
22. As a Maker, I want the outer border to have its **own colour, stroke, and radius**, so that the mat can differ from the inner card.
23. As a Maker, I want to set the **relative size of inner to outer** (mat amount), so that I control how wide the coloured backing shows.
24. As a Maker, I want the inner card to **float** within the mat for a playful look, so that the matting isn't rigidly centred.
25. As a Maker, I want a **minimum clearance** so the inner never comes closer to the outer than a set distance, so that the mat never disappears on one side.
26. As a Maker, I want the float **balanced** (the largest corner gap no more than k× the smallest), so that a card never bunches lopsidedly into one corner.
27. As a Maker, I want **layer-visibility toggles** for Outer / Inner / Text, so that I can show just what I need for each print pass.
28. As a Maker, I want to print the inner card + word first, then hide them and print just the mats, so that I can make the two matted layers that line up.

**Playfulness**

29. As a Maker, I want a **playful letters** style with independent random rotation and offset per letter, so that words look hand-made and fun.
30. As a Maker, I want a **Wave** letter style, so that letters flow along a sine curve for a "flowy" look.
31. As a Maker, I want an **Alternating** letter style, so that letters bounce up/down and tilt in a tidy zig-zag.
32. As a Maker, I want a **Smile** letter style, so that letters ride a gentle curved baseline like a smile.
33. As a Maker, I want sliders for letter rotation amount and vertical offset, so that I can tune how wild the letters are.
34. As a Maker, I want per-card random **tilt and shift**, so that the cards themselves look scattered like a toy.
35. As a Maker, I want dragging any "amount" slider to **continuously morph** the result, so that I can find the sweet spot without positions jumping around.
36. As a Maker, I want a **Randomize** button and a numeric **seed**, so that I can reshuffle to a fresh arrangement on demand — the only control that "jumps".

**Layout modes**

37. As a Maker, I want a **Grid** layout with aligned rows and columns, so that months look orderly.
38. As a Maker, I want a **Flexible** layout that packs cards tightly with ragged rows, so that I fit more on a sheet.
39. As a Maker, I want a **Random (scatter)** layout that spreads one arrangement across the page and tilts each card, so that the whole sheet reads as a toy even before cutting.
40. As a Maker, I want scattered cards to stay **within their slot** (no overlap), so that every card is still cleanly cuttable.
41. As a Maker, I want a **row alignment** (left/center/right) control, so that shaped text sits how I want.

**Paper, units & pages**

42. As a Maker, I want to pick a **paper size** from A0–A10, B0–B10, and US Letter/Legal/Tabloid, so that I match whatever stock I print on.
43. As a Maker, I want a **portrait/landscape** toggle, so that I can orient the sheet to fit more cards.
44. As a Maker, I want to set the **page margin** (default 15 mm), so that content stays within the printable area.
45. As a Maker, I want sizes in **mm** and font size in **pt**, so that dimensions match how I think about paper and type.
46. As a Maker, I want content to **flow across multiple pages** automatically, so that I'm never limited to one sheet.

**Fonts**

47. As a Maker, I want a **font picker** showing a sample image of each font instantly, so that I can choose before waiting for anything to load.
48. As a Maker, I want the default font (Comic Neue) to work **offline**, so that the tool is usable with no internet.
49. As a Maker, I want other curated fonts to **download on demand with a progress bar**, so that I know it's loading.
50. As a Maker, I want to enter **any Google Font by name**, so that I'm not limited to the curated list.
51. As a Maker, I want the exact chosen font **embedded in the PDF**, so that the print looks like the preview on any machine.

**Previews & export**

52. As a Maker, I want a **live main preview** of the paginated sheets, so that I see exactly what will print.
53. As a Maker, I want to **zoom** the preview, so that I can inspect details or see the whole page.
54. As a Maker, I want a **second preview** of one card enlarged in the top third of the chosen page, so that I can judge its proportions and mat clearance up close.
55. As a Maker, I want to **choose which token** the second preview shows (default the widest), so that I can check the worst-case fit.
56. As a Maker, I want a single **Download PDF** button, so that I get the whole multi-page result in one file.
57. As a Maker, I want Download **disabled until the font is ready**, so that I never get a PDF with the wrong font.

**Projects & sharing**

58. As a Maker, I want to save my work as a **named project** in the browser, so that I can return to it later.
59. As a Maker, I want to create, rename, duplicate, and delete projects, so that I can manage several designs.
60. As a Maker, I want a clear **warning that projects are stored only in this browser** and cannot be recovered if lost, so that I'm not surprised by data loss.
61. As a Maker, I want to **share a project by URL**, so that a colleague can open my exact design in their browser.
62. As a Maker, I want the shared link to carry **all settings** (including my text and font choice), so that nothing is missing on the other end.

## Implementation Decisions

**Deliverable & tech**

- Ships as **one static HTML page**, no server, publishable to github.io. Client-side only:
  vanilla JS (or a small framework compiled to static assets) + **jsPDF** for PDF output.
- The core is a **pure, dependency-free layout engine** authored as a testable module and
  inlined/bundled into the shipped page. This keeps the geometry logic unit-testable and portable
  (it is the single source of truth for all three render targets).

**Single source of truth: the layout engine**

- One pure function turns state into geometry: `computeLayout(state, env) → LayoutResult`, where
  `env` supplies text-measurement (page-side canvas `measureText`, so **preview and PDF share the
  same metrics** and match exactly).
- `LayoutResult` is a plain data tree: `pages[] → cards[] → { outerRect, innerRect, glyphs[] }`,
  each glyph carrying `{ char, x, y, rotationDeg }`, all in **mm**. The SVG main preview, the SVG
  second preview, and the jsPDF exporter are thin renderers over this same tree.

**State object (serialization contract)** — the single object that drives rendering, projects, and
URL-share. Shape (illustrative, not final field names):

```ts
type ProjectState = {
  schemaVersion: number
  name: string
  text: string                         // lines = Enter (hard row break), tokens = spaces
  page: { size: PaperSize; orientation: "portrait" | "landscape"; marginMm: number /*15*/ }
  layout: {
    mode: "grid" | "flexible" | "random"
    cardSizing: "uniform" | "fit"
    gapMm: number /*4*/
    rowAlign: "left" | "center" | "right" /*center*/
    grid: { columns: number | "auto" }
    random: { rotationDeg: number; shiftMm: number }   // clamp-to-cell scatter
  }
  card: {
    font: { family: string; source: "builtin" | "curated" | "custom"; sizePt: number; letterSpacingMm: number }
    textColor: string
    paddingMm: number                  // word→inner border; auto-grows to contain rotated letters
    offsetMm: number; rotationDeg: number   // per-card playful drift (seeded)
    inner: { color: string; strokeMm: number /*0.5*/; radiusMm: number /*0*/ }
    outer: {                            // the mat; present only when enabled
      enabled: boolean
      color: string; strokeMm: number; radiusMm: number
      matPercent: number               // relative size inner→outer
      minClearanceMm: number           // hard floor X
      balanceRatio: number             // k, enforce max(cornerGap) < k*min(cornerGap), default 2
    }
  }
  letters: {
    style: "random" | "wave" | "alternating" | "smile"
    rotationDeg: number; verticalMm: number
    horizontalJitterMm: number         // random style only
    waveFrequency: number              // wave style only (cycles per word)
  }
  visibility: { outer: boolean; inner: boolean; text: boolean }   // per print pass
  seed: number
}
```

**Container nesting & sizing**

- Nesting invariant: **Text ⊂ Inner border ⊂ Outer border ⊂ Cell**; each container auto-sizes to
  hold its contents plus its margin. Inner auto-grows by the worst-case letter excursion so no
  glyph crosses the cut line. Outer sized from `matPercent` with `minClearanceMm` as a floor.
- Card **sizing mode** sets cell width: `uniform` → widest token (aligned columns; "same space"
  invariant holds); `fit` → per-token width, uniform height (cards pack in rows).

**Seeded continuity (architectural invariant)**

- All randomness is derived deterministically from `seed` + card index + letter index (e.g. a hash
  → fixed unit direction / phase). Every "amount" parameter only **scales** these fixed
  directions/phases, so increasing an amount moves things **continuously** outward — it never
  re-rolls. Only changing `seed` (Randomize) reshuffles.

**Mat float clamping**

- The inner card's seeded drift+rotation inside the mat is scaled to the **largest magnitude that
  still satisfies both** `minClearanceMm` and the balance ratio, found per-card by a monotonic
  search along the seeded direction. This yields continuous motion (loosen k → drifts further;
  tighten clearance → pulls toward centre) with no popping. Corner clearance = distance from each
  inner corner to the nearest point of the outer border boundary (4 values; enforce max < k·min).

**Layout modes**

- **Grid**: aligned rows/columns of uniform cells; respects newlines as hard row breaks; with no
  newlines, auto-wraps into a balanced grid.
- **Flexible**: uniform cells, tight ragged reflow; respects newlines.
- **Random**: one page's tokens placed on an auto-sized grid of large cells spanning the page,
  each card tilted+shifted **within its cell** (clamp-to-cell → no overlap → still cuttable);
  flattens newlines; paginates when tokens exceed a page.
- All modes **paginate** across as many pages as needed.

**Fonts**

- **Comic Neue**: embedded in the page as base64 TTF → offline default, no fetch/decode.
- **Curated set** (Schoolbell, Twinkle Star, Yuyu, Playpen Sans, Coming Soon, Patrick Hand, Short
  Stack): each shown as a pre-baked **PNG thumbnail** (sample `January 0123456789`) embedded in the
  page; the TTF is fetched on selection with a **determinate progress bar** (stream vs
  `Content-Length`).
- **Custom Google Font**: family-name input. **Preview** via the Google Fonts API (resolves any
  family). **PDF embedding** requires TTF, so the fetched **woff2 is decoded to TTF via a
  lazily-loaded decoder** (loaded only when a non-default/custom font is first used). jsDelivr /
  Fontsource is the CORS-safe fallback source. Rationale: the Fonts API is the only reliable
  resolver for arbitrary family names; jsDelivr's google/fonts mirror requires guessing file paths
  that break for variable/oddly-named fonts.
- **Download PDF** is gated on the selected font being fully loaded.

**Export**

- **Multi-page PDF** via jsPDF in **mm** units at the chosen page size/orientation, drawing the
  `LayoutResult` tree, with the selected font embedded. Honours the **layer-visibility** toggles so
  the maker can export each matting pass separately.

**Previews**

- **Main**: paginated A4-style sheets rendered as SVG (mm viewBox, matching the reference
  `output/page.svg` convention), stacked and scrollable, with a **zoom** control.
- **Second**: one selected card (default the widest token) fit into the **top third of the
  currently-selected page** (size/orientation follow the project), for close inspection.

**Projects & sharing**

- Named **projects persisted in localStorage** (create/save/rename/duplicate/delete), plus a
  persistent **local-only, unrecoverable** warning.
- **URL share** encodes the full `ProjectState` into the **hash fragment** (compact JSON +
  LZ-compression to keep links short even with long text; the hash keeps state off the server).
  A non-default font travels as its **family name**; the opener re-fetches it.

**Progressive disclosure**

- The control panel shows **only the parameters relevant to the current mode/selection** (e.g. wave
  frequency only for Wave; scatter sliders only in Random; the outer-border group only when
  enabled).

## Testing Decisions

**What makes a good test here**: assert **external behaviour** of the pure engine — the geometry it
produces and the invariants it guarantees — not internal helpers or DOM structure. Tests feed a
`ProjectState` (+ a stub measurer) into `computeLayout` and assert on the returned data tree.

**Primary seam — the pure layout engine** (`computeLayout`). This is the single, highest seam:
SVG previews and the PDF all render from its output, so testing it covers tokenization,
pagination, sizing modes, nesting, mat clamping, seeded transforms, and layout modes without any
rendering. Representative tests:

- **Tokenization/lines**: whitespace splits into tokens; newlines force row breaks; blank lines
  produce empty rows; duplicate tokens produce duplicate cards.
- **Uniform invariant**: in `uniform` mode all cards share one footprint; in `fit` mode widths
  vary but heights are equal.
- **Cut-line containment**: for any letter/card amounts, every glyph's rotated bounding box stays
  inside the inner border (nothing crosses the cut line).
- **Mat invariants**: inner never closer than `minClearanceMm` to the outer on any side; the 4
  corner clearances satisfy `max < balanceRatio · min`.
- **No-overlap in Random**: clamp-to-cell scatter never places a card outside its cell → cards
  don't overlap.
- **Continuity (property-based)**: a small change to any "amount" parameter yields a small change
  in every card's position/rotation (no discontinuity); changing only `seed` may change everything.
- **Determinism**: same `state` → identical `LayoutResult` (reproducible across runs/machines).
- **Pagination**: token counts that exceed one page produce the expected number of pages.

**Secondary seam — state serialization** (`encode`/`decode` for URL + localStorage): pure
round-trip tests (`decode(encode(state)) deep-equals state`), schema-version handling, and
size/robustness of the compressed payload for long text.

**Font resolution** is I/O and is kept behind a thin adapter; it is covered by a small number of
integration checks (fetch → decode → embed produces a valid font in the PDF) rather than unit
tests, so the pure engine stays free of network concerns.

**Prior art**: none (greenfield). Establish the pattern with a standard JS test runner (e.g.
Vitest) driving the pure module. Property-based tests (e.g. fast-check) fit the continuity and
invariant checks well.

## Out of Scope

- **Gas-particle scatter simulation** mode (a physics-based scatter with a "freeze time" slider).
  Deliberately deferred; design captured in Further Notes. The v1 Random mode is the simple
  clamp-to-cell scatter.
- Any **repulsion/relaxation collision solver** for free (overlapping-then-separated) scatter —
  superseded by the future gas-sim; not built now.
- The **calendar stand / pockets** artifact (the folded three-panel base from the reference). This
  tool generates the **cards**; the stand is a separate template (cf. `_references/output/`).
- **Actually printing or tiling** oversized pages (A0/A1/B0/B1 exceed consumer printers). The PDF
  is produced at true size; physical printing/tiling is the maker's responsibility.
- **Non-Latin scripts** (English/Latin only; the curated fonts are Latin-only — Comic Neue has no
  Cyrillic).
- **Per-card manual editing** (hand-placing an individual card), **card fill/background colour**
  (an easy future add), and any **cloud storage / accounts** (storage is local only).
- **Multi-word-per-card** tokens (whitespace always separates cards).

## Further Notes

**Grounding**: `_references/` contains the source craft — the SDL "Fun project: A calendar"
workbook spread (make the stand, the month word-cards, the date digit-cards) and photos showing the
matted cards and playful tilted digit tiles. `_references/output/page.svg` shows the intended
SVG-in-mm → PDF pipeline (an A4-landscape fold-divider for the stand). This spec covers the
**card generator** half of that craft.

**Build order** (a working tool early, then the persistence layer over the same state object):
1. Pure layout engine + SVG main/second previews + controls.
2. Font picker (embedded Comic Neue + curated thumbnails + on-demand fetch + custom Google Font).
3. Multi-page PDF export (embedded font, layer visibility).
4. Projects (localStorage) + URL-share, as a thin layer over `ProjectState`.

**Deferred: gas-particle scatter mode (future).** A deterministic particle simulation is the
intended long-term answer for organic, overlap-free scatter, and it elegantly preserves continuity:
a "freeze at time T" slider is smooth by construction because it just integrates the same seeded
system further forward (no chaotic pops, unlike a repulsion solver). Sketch: seed → initial
velocities/spins; T=0 is the tidy grid; increasing T eases cards into motion; OBB collisions (SAT +
angular momentum) keep them apart; cards bounce off the page margin so everything stays on-page and
cuttable. It's parked only because the physics (elastic + rotational response, tunneling avoidance)
is a meaningful chunk of work; it slots in later as a fourth layout mode without disturbing the
others. The SAT overlap primitive it needs is the same one useful for any future collision work.
