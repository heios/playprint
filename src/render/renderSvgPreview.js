const MM_TO_PX = 3.7795275591; // 96dpi / 25.4mm, matches CSS "mm" units closely enough for on-screen preview

/**
 * Thin SVG renderer over a `LayoutResult` (see `../engine/computeLayout.js`).
 * Draws each page's card rects; nothing here computes geometry — it only
 * reads the tree `computeLayout` already produced, per SPEC.md's "SVG main
 * preview... thin renderers over this same tree."
 *
 * Stub for issue #1: renders outer/inner rects only, no glyphs/fonts yet.
 *
 * @param {import("../engine/computeLayout.js")} _unused
 * @param {{pages: Array<{cards: Array<{outerRect: object, innerRect: object}>}>}} layoutResult
 * @returns {SVGSVGElement}
 */
export function renderSvgPreview(layoutResult) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

  const page = layoutResult.pages[0];
  for (const card of page?.cards ?? []) {
    svg.appendChild(rectFor(card.outerRect));
    svg.appendChild(rectFor(card.innerRect));
  }

  return svg;
}

function rectFor(rect) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  el.setAttribute("x", String(rect.xMm * MM_TO_PX));
  el.setAttribute("y", String(rect.yMm * MM_TO_PX));
  el.setAttribute("width", String(rect.widthMm * MM_TO_PX));
  el.setAttribute("height", String(rect.heightMm * MM_TO_PX));
  return el;
}
