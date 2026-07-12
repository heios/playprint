// @ts-check
/**
 * Shared per-card TILT transform math (SPEC.md "preview and PDF share
 * metrics"; issue #24: renderer parity). Both `renderSvgPreview` and
 * `exportPdf` draw the SAME `LayoutResult` tree; a tilted card's `tiltDeg`
 * must rotate its whole body — inner/outer rects and every glyph — about the
 * engine-emitted `card.tiltOriginMm`, and BOTH renderers must agree on
 * exactly where that rotation lands, or the PDF and preview diverge (issue
 * #24's symptom: cards swinging out of their grid cells in the PDF only).
 *
 * `renderSvgPreview` gets this "for free": SVG's native
 * `<g transform="rotate(deg cx cy)">` operates directly in the engine's mm,
 * Y-down coordinate system, so writing the engine's `tiltDeg`/`tiltOriginMm`
 * straight onto the attribute IS correct by construction (see
 * `cardGroup()` in `renderSvgPreview.js`).
 *
 * `exportPdf` has no such native primitive for a whole-group rotation over a
 * mix of rects + text — it wraps the card's draws in a raw PDF content-stream
 * `cm` (current-transformation-matrix) operator instead. That operator does
 * NOT live in the mm/Y-down space the engine speaks: it lives in raw PDF user
 * space, which is (a) in POINTS, not mm, and (b) Y-UP with the origin at the
 * page's bottom-left. A matrix built directly from the engine's mm-space
 * `tiltOriginMm` (skipping both the mm->pt scale and the Y-axis flip) rotates
 * the card about the WRONG point — a rotation-plus-translation that swings
 * the card out of its grid cell, exactly issue #24's symptom.
 *
 * `pdfTiltMatrixParams` is the one place that derives the correct matrix, so
 * `exportPdf.js` stays a thin consumer of it (mirroring how `renderSvgPreview`
 * stays a thin consumer of the engine's own `tiltDeg`/`tiltOriginMm`).
 *
 * Derivation: PDF space relates to the engine's mm space by
 * `X = k*xMm`, `Y = pageHeightPt - k*yMm` (k = mm->pt scale factor). Requiring
 * the PDF-space image of every mm point to equal the PDF-space image of that
 * point's SVG-style rotation (`rotate(tiltDeg, cx, cy)` in mm/Y-down space)
 * works out — algebraically, for any k/pageHeight — to exactly the STANDARD
 * "rotate by -tiltDeg about (ox, oy)" 2D affine matrix, where `(ox, oy)` is
 * `tiltOriginMm` converted to PDF space (`ox = k*cx`, `oy = pageHeightPt -
 * k*cy`). The angle negates because PDF's Y-up handedness mirrors SVG's
 * Y-down handedness; the origin must ALSO move into PDF space (in points,
 * Y-flipped) for the fixed point of the rotation to land in the right place
 * — this second part is what the pre-#24 implementation omitted.
 *
 * @param {{ tiltDeg: number, originMm: { xMm: number, yMm: number } }} tilt
 * @param {{ toPdfX: (xMm: number) => number, toPdfY: (yMm: number) => number }} toPdfPoint
 *   Converters from engine mm-space to the PDF content-stream's raw user
 *   space (points, Y-up) for the page currently being drawn — jsPDF exposes
 *   these as `doc.internal.getHorizontalCoordinate` /
 *   `doc.internal.getVerticalCoordinate`, which already account for the
 *   mm->pt scale factor AND the per-page height/Y-flip, so this function asks
 *   for them rather than re-deriving `k`/`pageHeight` itself.
 * @returns {{ a: number, b: number, c: number, d: number, e: number, f: number }}
 *   The 6 components of a PDF affine matrix (`x' = a*x + c*y + e`,
 *   `y' = b*x + d*y + f`), ready for `doc.Matrix(a, b, c, d, e, f)`.
 */
export function pdfTiltMatrixParams({ tiltDeg, originMm }, { toPdfX, toPdfY }) {
  const rad = (-tiltDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const ox = toPdfX(originMm.xMm);
  const oy = toPdfY(originMm.yMm);

  // Standard "rotate by `rad` about (ox, oy)" affine matrix.
  return {
    a: cos,
    b: sin,
    c: -sin,
    d: cos,
    e: ox - ox * cos + oy * sin,
    f: oy - ox * sin - oy * cos,
  };
}
