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
 * glyphs, inner, tiltDeg, tiltOriginMm }` — dropping the intermediate
 * sizing/placement scratch fields. `tiltDeg` is the per-card playful rotation
 * the renderer applies as a group transform about `tiltOriginMm`, the
 * engine-emitted rotation centre (SPEC.md story 34).
 *
 * Input:  { state, env, doc: { rows, cards, page } }
 * Output: LayoutResult.
 *
 * Issue #2 emits a single page holding every card; multi-page vertical
 * overflow is a later slice that only splits `cards` across pages here, keeping
 * this pass's output shape fixed.
 */
export function paginate({ doc }) {
  const cards = doc.cards.map(({ outerRect, innerRect, glyphs, inner, tiltDeg, tiltOriginMm }) => ({
    outerRect,
    innerRect,
    glyphs,
    inner,
    tiltDeg,
    tiltOriginMm,
  }));

  const page = doc.page ?? {};
  return {
    pages: [
      {
        widthMm: page.widthMm,
        heightMm: page.heightMm,
        marginMm: page.marginMm,
        cards,
      },
    ],
  };
}
