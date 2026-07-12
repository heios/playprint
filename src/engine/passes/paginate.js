/**
 * Pass 7/7: paginate
 *
 * Emits the final `LayoutResult` — the value `computeLayout` returns:
 * `{ pages: [{ widthMm, heightMm, marginMm, cards: [...] }] }`. Each page
 * carries its paper dimensions in mm so the SVG renderers and the PDF exporter
 * can set an mm viewBox (SPEC.md "Previews": mm viewBox, `output/page.svg`
 * convention) without recomputing geometry.
 *
 * Each card is trimmed to the render contract — `{ outerRect, innerRect,
 * glyphs, inner, outer, textVisible, tiltDeg, tiltOriginMm }` — dropping the
 * intermediate sizing/placement scratch fields. `inner`/`outer` carry each
 * border's style plus its per-pass `visible` flag (SPEC.md stories 22, 27);
 * `textVisible` gates the glyphs (story 27). `tiltDeg` is the per-card playful
 * rotation the renderer applies as a group transform about `tiltOriginMm`, the
 * engine-emitted rotation centre (SPEC.md story 34).
 *
 * Input:  { state, env, doc: { rows, cards, page } }
 * Output: LayoutResult.
 *
 * Cards are split across pages by the `pageIndex` every layout mode's `place`
 * branch already assigns (SPEC.md story 46: "All modes paginate across as many
 * pages as needed") — Grid/Flexible wrap to a new page when the next row
 * overflows the usable height, Random wraps when tokens exceed a page's large
 * cells; a card with no `pageIndex` defaults to page 0. The render contract
 * per card stays fixed regardless of how many pages there are.
 */
export function paginate({ doc }) {
  const page = doc.page ?? {};

  // Group cards by their emitted page (default page 0), preserving order.
  const byPage = new Map();
  for (const card of doc.cards) {
    const idx = card.pageIndex ?? 0;
    if (!byPage.has(idx)) byPage.set(idx, []);
    byPage.get(idx).push(trim(card));
  }
  if (byPage.size === 0) byPage.set(0, []);

  const pageIndices = [...byPage.keys()].sort((a, b) => a - b);
  const pages = pageIndices.map((idx) => ({
    widthMm: page.widthMm,
    heightMm: page.heightMm,
    marginMm: page.marginMm,
    cards: byPage.get(idx),
  }));

  return { pages };
}

/** Trim an internal card down to the render contract. */
function trim({ outerRect, innerRect, glyphs, inner, outer, textVisible, tiltDeg, tiltOriginMm }) {
  return { outerRect, innerRect, glyphs, inner, outer, textVisible, tiltDeg, tiltOriginMm };
}
