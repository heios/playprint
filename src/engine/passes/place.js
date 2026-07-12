import { pageDimensionsMm } from "../paperSizes.js";

/**
 * Pass 3/6: place
 *
 * Assigns each sized card an (x, y) in mm on the page, for the Grid layout
 * (SPEC.md user stories 37, 41 and 7–9). Grid draws uniform cells in aligned
 * rows/columns:
 *
 *   - Hard rows come straight from `tokenize` (newlines → row breaks, a blank
 *     line → an empty row that still advances the y cursor by one row height).
 *   - Soft-wrap (story 9): a source row wider than the page's usable width is
 *     broken into several visual rows so no card runs off the sheet.
 *   - `layout.rowAlign` (left/center/right) positions each visual row's block
 *     within the usable width; with uniform cells and equal-length rows this
 *     keeps columns aligned.
 *   - `layout.gapMm` separates neighbouring cells both across and down.
 *
 * Positions are page-relative, offset by `page.marginMm`. Flexible/random
 * modes are later slices that branch on `layout.mode` here without touching
 * neighbouring passes.
 *
 * Input:  { state, env, doc: { rows, cards } }
 * Output: { state, env, doc: { rows, cards: PlacedCard[], page } }
 *   PlacedCard: { ...SizedCard, xMm, yMm, widthMm, heightMm }
 */
export function place({ state, env, doc }) {
  const marginMm = state?.page?.marginMm ?? 0;
  const gapMm = state?.layout?.gapMm ?? 0;
  const rowAlign = state?.layout?.rowAlign ?? "center";
  const { widthMm: pageWidthMm, heightMm: pageHeightMm } = pageDimensionsMm(state?.page ?? {});
  const usableWidthMm = pageWidthMm - 2 * marginMm;

  // Uniform footprint: every card shares one width/height (size pass).
  const cellWidthMm = doc.cards.reduce((m, c) => Math.max(m, c.innerWidthMm), 0);
  const cellHeightMm = doc.cards.reduce((m, c) => Math.max(m, c.innerHeightMm), 0);

  // Rebuild source rows (including empty ones) from tokenize's `rows`, pairing
  // each token with its sized card in order.
  const byRow = groupByRow(doc.rows, doc.cards);

  // How many uniform cells fit across the usable width (at least one, so a
  // single over-wide card still lands on its own visual row).
  const perVisualRow = Math.max(1, Math.floor((usableWidthMm + gapMm) / (cellWidthMm + gapMm)) || 1);

  const placed = [];
  let yMm = marginMm;

  for (const sourceRow of byRow) {
    if (sourceRow.length === 0) {
      // Blank line → empty spacer row: advance one row height (+ gap).
      yMm += cellHeightMm + gapMm;
      continue;
    }

    // Soft-wrap this source row into visual rows of at most `perVisualRow`.
    for (let i = 0; i < sourceRow.length; i += perVisualRow) {
      const visualRow = sourceRow.slice(i, i + perVisualRow);
      const rowWidthMm = visualRow.length * cellWidthMm + (visualRow.length - 1) * gapMm;
      const startXMm = marginMm + alignOffset(rowAlign, usableWidthMm, rowWidthMm);

      visualRow.forEach((card, col) => {
        placed.push({
          ...card,
          widthMm: cellWidthMm,
          heightMm: cellHeightMm,
          xMm: startXMm + col * (cellWidthMm + gapMm),
          yMm,
        });
      });
      yMm += cellHeightMm + gapMm;
    }
  }

  return {
    state,
    env,
    doc: { ...doc, cards: placed, page: { widthMm: pageWidthMm, heightMm: pageHeightMm, marginMm } },
  };
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
