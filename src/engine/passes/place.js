import { pageDimensionsMm } from "../paperSizes.js";

/**
 * Pass 3/7: place
 *
 * Assigns each sized card an (x, y) in mm on the page, branching on
 * `layout.mode` (SPEC.md "Layout modes", user stories 37–41 and 7–9). Every
 * mode is a pure function of the sized cards + page geometry; adding a mode is
 * a new branch here, never a new pass reaching across the seam.
 *
 *   - **grid**: aligned rows/columns of UNIFORM cells (widest footprint), honours
 *     hard rows (newlines), blank spacer rows, soft-wrap, and `rowAlign`. Rows
 *     flow down the page via the shared `makePager` helper (below): a row that
 *     wouldn't fit in the remaining usable height starts a fresh page instead.
 *   - **flexible**: tight ragged rows of per-card-width cells (uniform height),
 *     packed left-to-right and wrapped when a row overflows; honours hard rows,
 *     blank rows and `rowAlign`. In `uniform` sizing the widths all match, so it
 *     degenerates to a tidy tight grid. Paginates via the same row pager as grid.
 *   - **random**: flattens rows and lays every token on an auto-sized grid of
 *     LARGE cells spanning the usable page; each card is centred in its cell and
 *     carries its `cellMm` rect so the later `scatter` pass can tilt+shift it
 *     WITHIN the cell (clamp-to-cell → no overlap → still cuttable). Paginates
 *     when tokens exceed a page's cells.
 *
 * All three modes paginate (SPEC.md story 46, "All modes paginate across as
 * many pages as needed") by assigning each placed card a `pageIndex`; the
 * `paginate` pass (last in the pipeline) groups cards by that index into
 * `LayoutResult.pages[]`. A card with no `pageIndex` defaults to page 0.
 *
 * Positions are page-relative, offset by `page.marginMm`.
 *
 * Input:  { state, env, doc: { rows, cards } }
 * Output: { state, env, doc: { rows, cards: PlacedCard[], page } }
 *   PlacedCard: { ...SizedCard, xMm, yMm, widthMm, heightMm, pageIndex?, cellMm? }
 */
export function place({ state, env, doc }) {
  const marginMm = state?.page?.marginMm ?? 0;
  const mode = state?.layout?.mode ?? "grid";
  const { widthMm: pageWidthMm, heightMm: pageHeightMm } = pageDimensionsMm(state?.page ?? {});
  const page = { widthMm: pageWidthMm, heightMm: pageHeightMm, marginMm };

  const placed =
    mode === "random"
      ? placeRandom({ state, doc, page })
      : mode === "flexible"
        ? placeFlexible({ state, doc, page })
        : placeGrid({ state, doc, page });

  return { state, env, doc: { ...doc, cards: placed, page } };
}

/* --------------------------------------------------------------------------
 * Grid: uniform cells in aligned rows/columns.
 * ------------------------------------------------------------------------ */
function placeGrid({ state, doc, page }) {
  const gapMm = state?.layout?.gapMm ?? 0;
  const rowAlign = state?.layout?.rowAlign ?? "center";
  const usableWidthMm = page.widthMm - 2 * page.marginMm;
  const usableHeightMm = page.heightMm - 2 * page.marginMm;

  const cellWidthMm = maxWidth(doc.cards);
  const cellHeightMm = maxHeight(doc.cards);

  const byRow = groupByRow(doc.rows, doc.cards);
  const perVisualRow = Math.max(1, Math.floor((usableWidthMm + gapMm) / (cellWidthMm + gapMm)) || 1);

  const placed = [];
  const pager = makePager({ page, usableHeightMm });

  for (const sourceRow of byRow) {
    if (sourceRow.length === 0) {
      pager.advance(cellHeightMm + gapMm);
      continue;
    }
    for (let i = 0; i < sourceRow.length; i += perVisualRow) {
      const visualRow = sourceRow.slice(i, i + perVisualRow);
      const rowWidthMm = visualRow.length * cellWidthMm + (visualRow.length - 1) * gapMm;
      const startXMm = page.marginMm + alignOffset(rowAlign, usableWidthMm, rowWidthMm);
      const { yMm, pageIndex } = pager.rowStart(cellHeightMm);

      visualRow.forEach((card, col) => {
        placed.push({
          ...card,
          widthMm: cellWidthMm,
          heightMm: cellHeightMm,
          xMm: startXMm + col * (cellWidthMm + gapMm),
          yMm,
          pageIndex,
        });
      });
      pager.advance(cellHeightMm + gapMm);
    }
  }
  return placed;
}

/* --------------------------------------------------------------------------
 * Flexible: tight ragged rows; each card keeps its own width, height uniform.
 * ------------------------------------------------------------------------ */
function placeFlexible({ state, doc, page }) {
  const gapMm = state?.layout?.gapMm ?? 0;
  const rowAlign = state?.layout?.rowAlign ?? "center";
  const usableWidthMm = page.widthMm - 2 * page.marginMm;
  const usableHeightMm = page.heightMm - 2 * page.marginMm;
  const cellHeightMm = maxHeight(doc.cards);

  const byRow = groupByRow(doc.rows, doc.cards);

  const placed = [];
  const pager = makePager({ page, usableHeightMm });

  for (const sourceRow of byRow) {
    if (sourceRow.length === 0) {
      pager.advance(cellHeightMm + gapMm);
      continue;
    }
    // Greedily pack cards into visual rows: start a new row when the next card
    // would overflow the usable width (but never leave a visual row empty, so a
    // single over-wide card still lands on its own row).
    let i = 0;
    while (i < sourceRow.length) {
      const visualRow = [];
      let rowWidthMm = 0;
      while (i < sourceRow.length) {
        const w = sourceRow[i].innerWidthMm;
        const addWidth = visualRow.length === 0 ? w : gapMm + w;
        if (visualRow.length > 0 && rowWidthMm + addWidth > usableWidthMm + 1e-9) break;
        rowWidthMm += addWidth;
        visualRow.push(sourceRow[i]);
        i++;
      }
      const startXMm = page.marginMm + alignOffset(rowAlign, usableWidthMm, rowWidthMm);
      const { yMm, pageIndex } = pager.rowStart(cellHeightMm);
      let xMm = startXMm;
      for (const card of visualRow) {
        placed.push({
          ...card,
          widthMm: card.innerWidthMm,
          heightMm: cellHeightMm,
          xMm,
          yMm,
          pageIndex,
        });
        xMm += card.innerWidthMm + gapMm;
      }
      pager.advance(cellHeightMm + gapMm);
    }
  }
  return placed;
}

/* --------------------------------------------------------------------------
 * Random: large cells spanning the page; card centred, carries its cell rect.
 * ------------------------------------------------------------------------ */
function placeRandom({ state, doc, page }) {
  const gapMm = state?.layout?.gapMm ?? 0;
  const usableWidthMm = page.widthMm - 2 * page.marginMm;
  const usableHeightMm = page.heightMm - 2 * page.marginMm;

  const cardWidthMm = maxWidth(doc.cards);
  const cardHeightMm = maxHeight(doc.cards);

  // A card can tilt up to `random.rotationDeg`; a cell must fit the card's
  // WORST-CASE rotated bounding box (plus the gap) so clamp-to-cell always has
  // room. Column/row counts are chosen so cells stay at least this big.
  const rotationDeg = num(state?.layout?.random?.rotationDeg);
  const rad = (Math.abs(rotationDeg) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const rotWidthMm = cardWidthMm * cos + cardHeightMm * sin;
  const rotHeightMm = cardWidthMm * sin + cardHeightMm * cos;
  const minCellWidthMm = rotWidthMm + gapMm;
  const minCellHeightMm = rotHeightMm + gapMm;

  // Fit as many large cells across/down as the page allows (at least one each).
  const cols = Math.max(1, Math.floor((usableWidthMm + gapMm) / minCellWidthMm) || 1);
  const rows = Math.max(1, Math.floor((usableHeightMm + gapMm) / minCellHeightMm) || 1);
  const perPage = cols * rows;

  // Cells span the usable area evenly (so scatter reads across the whole sheet).
  const cellWidthMm = (usableWidthMm - (cols - 1) * gapMm) / cols;
  const cellHeightMm = (usableHeightMm - (rows - 1) * gapMm) / rows;

  const placed = [];
  doc.cards.forEach((card, idx) => {
    const pageIndex = Math.floor(idx / perPage);
    const cellIndex = idx % perPage;
    const cr = Math.floor(cellIndex / cols);
    const cc = cellIndex % cols;

    const cellXMm = page.marginMm + cc * (cellWidthMm + gapMm);
    const cellYMm = page.marginMm + cr * (cellHeightMm + gapMm);

    placed.push({
      ...card,
      widthMm: cardWidthMm,
      heightMm: cardHeightMm,
      // Base position centres the card in its cell; scatter shifts within.
      xMm: cellXMm + (cellWidthMm - cardWidthMm) / 2,
      yMm: cellYMm + (cellHeightMm - cardHeightMm) / 2,
      pageIndex,
      cellMm: { xMm: cellXMm, yMm: cellYMm, widthMm: cellWidthMm, heightMm: cellHeightMm },
    });
  });
  return placed;
}

/* --------------------------------- helpers -------------------------------- */

/**
 * Vertical row-flow pager shared by Grid and Flexible (SPEC.md story 46: "All
 * modes paginate across as many pages as needed"). Rows are emitted
 * top-to-bottom on a page exactly as before; when the NEXT row wouldn't fit in
 * the remaining usable height, the pager wraps to a fresh page (yMm resets to
 * `page.marginMm`, `pageIndex` increments) rather than growing past the sheet.
 * A row taller than a whole page still lands (its own row, page never blocked).
 */
function makePager({ page, usableHeightMm }) {
  let pageIndex = 0;
  let yMm = page.marginMm;

  return {
    /** Returns this row's { yMm, pageIndex }, wrapping to a new page first if needed. */
    rowStart(rowHeightMm) {
      const usedMm = yMm - page.marginMm;
      const wouldOverflow = usedMm > 1e-9 && usedMm + rowHeightMm > usableHeightMm + 1e-9;
      if (wouldOverflow) {
        pageIndex += 1;
        yMm = page.marginMm;
      }
      return { yMm, pageIndex };
    },
    /** Advance past the row just placed (or a blank spacer row) by its height. */
    advance(rowHeightMm) {
      yMm += rowHeightMm;
    },
  };
}

function maxWidth(cards) {
  return cards.reduce((m, c) => Math.max(m, c.innerWidthMm), 0);
}
function maxHeight(cards) {
  return cards.reduce((m, c) => Math.max(m, c.innerHeightMm), 0);
}

/** Left edge offset of a row block within the usable width for the alignment. */
function alignOffset(align, usableWidthMm, rowWidthMm) {
  if (align === "right") return Math.max(0, usableWidthMm - rowWidthMm);
  if (align === "center") return Math.max(0, (usableWidthMm - rowWidthMm) / 2);
  return 0; // left
}

/**
 * Pair each token in `rows` (which preserves empty rows) with its sized card,
 * consuming `cards` in row-major order. Returns an array of rows, each a list
 * of cards (empty for blank lines).
 */
function groupByRow(rows, cards) {
  const out = [];
  let idx = 0;
  for (const tokens of rows) {
    const row = [];
    for (let c = 0; c < tokens.length; c++) row.push(cards[idx++]);
    out.push(row);
  }
  return out;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
