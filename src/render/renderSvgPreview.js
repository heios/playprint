const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Thin SVG renderer over a `LayoutResult` (see `../engine/computeLayout.js`).
 * It reads the tree the engine already produced and draws it; it computes NO
 * geometry of its own (SPEC.md: "the SVG main preview... [is a] thin renderer
 * over this same tree").
 *
 * The page is an SVG whose `viewBox` is the paper size in mm (matching the
 * reference `output/page.svg` convention), so every coordinate the engine
 * emitted — all in mm — is written straight onto attributes with no unit
 * conversion here. CSS sizes the element on screen; the mm viewBox is the
 * single geometric contract shared with the PDF exporter.
 *
 * Each card draws its inner border rect (honouring colour, stroke-mm, corner
 * radius, and the on/off `visible` flag) and its glyphs as `<text>` at the
 * mm positions the engine chose.
 *
 * @param {{ pages: Array<{ widthMm:number, heightMm:number, cards: Array<object> }> }} layoutResult
 * @param {{ fontFamily?: string, sizePt?: number, textColor?: string }} [opts]
 * @returns {SVGSVGElement}
 */
export function renderSvgPreview(layoutResult, opts = {}) {
  const page = layoutResult.pages?.[0] ?? { widthMm: 0, heightMm: 0, cards: [] };
  const { fontFamily = "sans-serif", sizePt = 24, textColor = "#000000" } = opts;

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${page.widthMm} ${page.heightMm}`);
  svg.setAttribute("width", `${page.widthMm}mm`);
  svg.setAttribute("height", `${page.heightMm}mm`);

  // Paper backdrop, so the sheet is visible behind the cards.
  const sheet = document.createElementNS(SVG_NS, "rect");
  sheet.setAttribute("x", "0");
  sheet.setAttribute("y", "0");
  sheet.setAttribute("width", String(page.widthMm));
  sheet.setAttribute("height", String(page.heightMm));
  sheet.setAttribute("fill", "#ffffff");
  svg.appendChild(sheet);

  for (const card of page.cards) {
    if (card.inner?.visible !== false) svg.appendChild(borderRect(card.innerRect, card.inner));
    for (const glyph of card.glyphs ?? []) {
      svg.appendChild(glyphText(glyph, { fontFamily, sizePt, textColor }));
    }
  }

  return svg;
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
  const MM_PER_PT = 0.352778;
  const el = document.createElementNS(SVG_NS, "text");
  el.setAttribute("x", String(glyph.x));
  // `glyph.y` is already the baseline (the engine owns all vertical geometry),
  // so it is written unchanged — the renderer adds no vertical offset. Only the
  // pt→mm font-size conversion remains here.
  el.setAttribute("y", String(glyph.y));
  el.setAttribute("font-family", fontFamily);
  el.setAttribute("font-size", `${sizePt * MM_PER_PT}mm`);
  el.setAttribute("fill", textColor);
  if (glyph.rotationDeg) el.setAttribute("transform", `rotate(${glyph.rotationDeg} ${glyph.x} ${glyph.y})`);
  el.textContent = glyph.char;
  return el;
}
