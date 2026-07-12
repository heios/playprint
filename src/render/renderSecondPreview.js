import { renderPageSvg, cardGroup } from "./renderSvgPreview.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Pick the default second-preview card on a page: the widest one (by its
 * outer rect), so the maker sees the worst-case fit first (SPEC.md story 55:
 * "choose which token the second preview shows (default the widest)"). Ties
 * keep the first card in document order for determinism. Pure — no DOM — so
 * it's directly unit-testable.
 *
 * @param {{ cards: Array<{ outerRect: { widthMm: number } }> }} page
 * @returns {number} index of the widest card within `page.cards`, or -1 if empty.
 */
export function widestCardIndex(page) {
  const cards = page?.cards ?? [];
  let best = -1;
  let bestWidth = -Infinity;
  cards.forEach((card, i) => {
    const w = card.outerRect?.widthMm ?? 0;
    if (w > bestWidth) {
      bestWidth = w;
      best = i;
    }
  });
  return best;
}

/**
 * Thin SVG renderer for the "second preview" (SPEC.md stories 54–55): one
 * selected card from the currently-selected page, enlarged into the TOP THIRD
 * of a sheet sized/oriented like the project's page (size/orientation follow
 * the project), for close inspection of proportions and mat clearance.
 *
 * Still a thin renderer over the `LayoutResult` the engine already computed —
 * it draws the SAME card geometry `renderSvgPreview` would (via the shared
 * `cardGroup` helper), just scaled+centred into the top-third viewport. No new
 * layout math beyond that uniform fit-and-centre transform.
 *
 * @param {{ widthMm:number, heightMm:number, cards: Array<object> }} page the
 *   currently-selected page from a `LayoutResult`.
 * @param {number} [cardIndex] index into `page.cards`; defaults to the widest.
 * @param {{ fontFamily?: string, sizePt?: number, textColor?: string }} [opts]
 * @returns {SVGSVGElement}
 */
export function renderSecondPreview(page, cardIndex, opts = {}) {
  const { fontFamily = "sans-serif", sizePt = 24, textColor = "#000000" } = opts;
  const { widthMm = 0, heightMm = 0, cards = [] } = page ?? {};
  const index = cardIndex ?? widestCardIndex(page);
  const card = cards[index];

  const topThirdHeightMm = heightMm / 3;

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${widthMm} ${topThirdHeightMm}`);
  svg.setAttribute("width", `${widthMm}mm`);
  svg.setAttribute("height", `${topThirdHeightMm}mm`);
  svg.setAttribute("data-role", "second-preview");

  const backdrop = document.createElementNS(SVG_NS, "rect");
  backdrop.setAttribute("x", "0");
  backdrop.setAttribute("y", "0");
  backdrop.setAttribute("width", String(widthMm));
  backdrop.setAttribute("height", String(topThirdHeightMm));
  backdrop.setAttribute("fill", "#ffffff");
  svg.appendChild(backdrop);

  if (!card) return svg;

  // Fit the card's outer footprint into the top-third viewport (leaving a 10%
  // breathing margin) and centre it — a uniform scale+translate, not a
  // re-derivation of any engine geometry.
  const rect = card.outerRect;
  const marginFactor = 0.9;
  const scale = Math.min(
    (widthMm * marginFactor) / Math.max(rect.widthMm, 1e-6),
    (topThirdHeightMm * marginFactor) / Math.max(rect.heightMm, 1e-6),
  );
  const cx = rect.xMm + rect.widthMm / 2;
  const cy = rect.yMm + rect.heightMm / 2;
  const tx = widthMm / 2 - scale * cx;
  const ty = topThirdHeightMm / 2 - scale * cy;

  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("transform", `translate(${tx} ${ty}) scale(${scale})`);
  group.appendChild(cardGroup(card, { fontFamily, sizePt, textColor }));
  svg.appendChild(group);

  return svg;
}

// Re-exported for callers that want the full-page renderer alongside this one.
export { renderPageSvg };
