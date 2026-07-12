// @ts-check
/** @import { LayoutResult } from '../engine/types.js' */

const SVG_NS = "http://www.w3.org/2000/svg";
const MM_PER_PT = 0.352778;

/**
 * Thin SVG renderer over a `LayoutResult` (see `../engine/computeLayout.js`).
 * It reads the tree the engine already produced and draws it; it computes NO
 * geometry of its own (SPEC.md: "the SVG main preview... [is a] thin renderer
 * over this same tree").
 *
 * Each page is its own SVG whose `viewBox` is that page's paper size in mm
 * (matching the reference `output/page.svg` convention), so every coordinate
 * the engine emitted — all in mm — is written straight onto attributes with no
 * unit conversion here. The pages are returned stacked inside one scrollable
 * container (SPEC.md story 52: "a live main preview of the paginated sheets");
 * `opts.zoomPercent` scales the on-screen CSS size of every sheet uniformly
 * (story 53) while the mm viewBox — the geometric contract shared with the PDF
 * exporter — never changes.
 *
 * Each card draws its outer mat rect (when present) behind its inner border
 * rect (both honouring their own colour, stroke-mm, corner radius, and per-pass
 * `visible` flag — SPEC.md stories 22, 27) and its glyphs as `<text>` at the mm
 * positions the engine chose. The glyphs are gated by the card's `textVisible`
 * flag so the Text layer can be hidden for a print pass.
 *
 * @param {LayoutResult} layoutResult
 * @param {{ fontFamily?: string, sizePt?: number, textColor?: string, zoomPercent?: number }} [opts]
 * @returns {HTMLDivElement} a container with one <svg> sheet per page, stacked.
 */
export function renderSvgPreview(layoutResult, opts = {}) {
  const { zoomPercent = 100 } = opts;
  const pages = layoutResult.pages ?? [];

  const container = document.createElement("div");
  container.className = "preview-pages";
  container.style.overflow = "auto";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.gap = "1rem";

  pages.forEach((page, index) => {
    const wrap = document.createElement("div");
    wrap.className = "preview-page";
    wrap.dataset.pageIndex = String(index);

    const svg = renderPageSvg(page, opts);
    const scale = Math.max(0, Number(zoomPercent) || 0) / 100;
    svg.style.width = `${page.widthMm * scale}mm`;
    svg.style.height = `${page.heightMm * scale}mm`;

    wrap.appendChild(svg);
    container.appendChild(wrap);
  });

  return container;
}

/**
 * Draw a single page's sheet as an `<svg>` with an mm viewBox. Exported so the
 * second preview (`renderSecondPreview.js`) can draw the very same per-card
 * markup for one enlarged card without duplicating the border/glyph drawing.
 *
 * @param {{ widthMm:number, heightMm:number, cards: Array<object> }} page
 * @param {{ fontFamily?: string, sizePt?: number, textColor?: string }} [opts]
 * @returns {SVGSVGElement}
 */
export function renderPageSvg(page, opts = {}) {
  const { fontFamily = "sans-serif", sizePt = 24, textColor = "#000000" } = opts;
  const { widthMm = 0, heightMm = 0, cards = [] } = page ?? {};

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${widthMm} ${heightMm}`);
  svg.setAttribute("width", `${widthMm}mm`);
  svg.setAttribute("height", `${heightMm}mm`);

  // Paper backdrop, so the sheet is visible behind the cards.
  const sheet = document.createElementNS(SVG_NS, "rect");
  sheet.setAttribute("x", "0");
  sheet.setAttribute("y", "0");
  sheet.setAttribute("width", String(widthMm));
  sheet.setAttribute("height", String(heightMm));
  sheet.setAttribute("fill", "#ffffff");
  svg.appendChild(sheet);

  cards.forEach((card, index) => {
    const group = cardGroup(card, { fontFamily, sizePt, textColor });
    group.dataset.cardIndex = String(index);
    svg.appendChild(group);
  });

  return svg;
}

/**
 * Build one card's `<g>` — outer mat, inner border, glyphs — exactly as the
 * engine described it. Shared by the main and second previews.
 */
export function cardGroup(card, { fontFamily, sizePt, textColor }) {
  const group = document.createElementNS(SVG_NS, "g");
  // Per-card playful tilt is a group rotation about the engine-emitted origin
  // (the engine emits both `tiltDeg` and its rotation centre `tiltOriginMm`;
  // the renderer stays thin and only applies them — it derives no geometry).
  if (card.tiltDeg) {
    const { xMm, yMm } = card.tiltOriginMm;
    group.setAttribute("transform", `rotate(${card.tiltDeg} ${xMm} ${yMm})`);
  }

  // Outer mat first (behind), then the inner border, then the text — each
  // gated by the per-pass visibility the engine emitted (the renderer only
  // reads flags; it derives no geometry).
  if (card.outer?.visible) group.appendChild(borderRect(card.outerRect, card.outer));
  if (card.inner?.visible !== false) group.appendChild(borderRect(card.innerRect, card.inner));
  if (card.textVisible !== false) {
    for (const glyph of card.glyphs ?? []) {
      group.appendChild(glyphText(glyph, { fontFamily, sizePt, textColor }));
    }
  }
  return group;
}

function borderRect(rect, inner = {}) {
  const el = document.createElementNS(SVG_NS, "rect");
  el.setAttribute("x", String(rect.xMm));
  el.setAttribute("y", String(rect.yMm));
  el.setAttribute("width", String(rect.widthMm));
  el.setAttribute("height", String(rect.heightMm));
  el.setAttribute("fill", "none");
  el.setAttribute("stroke", inner.color ?? "#000000");
  el.setAttribute("stroke-width", String(inner.strokeMm ?? 0.5));
  if (inner.radiusMm) el.setAttribute("rx", String(inner.radiusMm));
  return el;
}

function glyphText(glyph, { fontFamily, sizePt, textColor }) {
  const el = document.createElementNS(SVG_NS, "text");
  el.setAttribute("x", String(glyph.x));
  // `glyph.y` is already the baseline (the engine owns all vertical geometry),
  // so it is written unchanged — the renderer adds no vertical offset. Only the
  // pt→mm font-size conversion remains here.
  el.setAttribute("y", String(glyph.y));
  el.setAttribute("font-family", fontFamily);
  // Unitless, in the same mm user-coordinate space as `x`/`y` (both come from
  // the page's mm `viewBox`). A physical-unit suffix here (e.g. "mm") would
  // resolve against CSS/physical pixels instead of scaling with the
  // viewBox-relative coordinates — see issue #29.
  el.setAttribute("font-size", String(sizePt * MM_PER_PT));
  el.setAttribute("fill", textColor);
  if (glyph.rotationDeg) el.setAttribute("transform", `rotate(${glyph.rotationDeg} ${glyph.x} ${glyph.y})`);
  el.textContent = glyph.char;
  return el;
}
