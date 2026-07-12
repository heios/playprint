import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { exportPdf } from "../exportPdf.js";
import { computeLayout } from "../../engine/computeLayout.js";
import { createStubEnv } from "../../engine/__tests__/stubEnv.js";
import { makeState } from "../../engine/__tests__/testState.js";
import { comicNeueTtfBytes, COMIC_NEUE_FAMILY } from "../../fonts/comicNeue.js";

/**
 * Issue #24: exported PDF must match the on-screen preview for tilted cards
 * (grid + uniform layout, playful tilt on). Both `renderSvgPreview` and
 * `exportPdf` draw the SAME `LayoutResult`; `renderSvgPreview` applies a
 * card's tilt as a native SVG `<g transform="rotate(tiltDeg cx cy)">` about
 * `card.tiltOriginMm` — that IS the preview's ground truth for "where does
 * this card's geometry end up after tilt" (see `cardGroup()` in
 * `../../render/renderSvgPreview.js`).
 *
 * This test does NOT re-implement a second SVG-vs-PDF pixel comparison
 * harness. Instead it holds `exportPdf` to a genuine, falsifiable geometric
 * assertion: whatever PDF content-stream matrix (`cm`) it emits for a
 * tilted card must map that card's own PDF-space points (rect corners,
 * origin) to EXACTLY where the SVG's `rotate(tiltDeg, cx, cy)` convention
 * would put the corresponding mm points, once both are expressed in PDF
 * space. A pre-#24 regression (CTM built directly from raw mm coordinates,
 * skipping the mm->pt scale and Y-axis flip) fails this: the tilt origin
 * does NOT map to itself, so the card visibly drifts off its grid cell.
 */

function svgRotateMm({ xMm, yMm }, originMm, tiltDeg) {
  const rad = (tiltDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = xMm - originMm.xMm;
  const dy = yMm - originMm.yMm;
  return {
    xMm: originMm.xMm + dx * cos - dy * sin,
    yMm: originMm.yMm + dx * sin + dy * cos,
  };
}

function rectCorners(rect) {
  const { xMm, yMm, widthMm, heightMm } = rect;
  return [
    { xMm, yMm },
    { xMm: xMm + widthMm, yMm },
    { xMm: xMm + widthMm, yMm: yMm + heightMm },
    { xMm, yMm: yMm + heightMm },
  ];
}

/** Build a layout with grid/uniform layout and playful per-card tilt on. */
function tiltedLayout() {
  const env = createStubEnv({ charWidthMm: 5 });
  const state = makeState({
    text: "Jan\nFeb\nMar",
    layout: { mode: "grid", cardSizing: "uniform" },
    card: { offsetMm: 3, rotationDeg: 12 },
  });
  return computeLayout(state, env);
}

/**
 * Build a layout that also exercises the two other AC-named scenarios: a mat
 * (outer border, SPEC.md stories 20-28) and multi-page pagination (a small
 * page size + enough cards to force a page break) — both alongside the same
 * playful per-card tilt.
 */
function tiltedMattedMultiPageLayout() {
  const env = createStubEnv({ charWidthMm: 5 });
  const many = Array.from({ length: 12 }, (_, i) => `Card${i}`).join("\n");
  const state = makeState({
    text: many,
    layout: { mode: "grid", cardSizing: "uniform" },
    card: { offsetMm: 2, rotationDeg: 15, outer: { enabled: true } },
    page: { size: "A7", orientation: "portrait", marginMm: 5 },
  });
  return computeLayout(state, env);
}

/**
 * A `PdfCtor` that constructs a REAL `jsPDF` instance, then patches its own
 * (instance-bound, not prototype) `setCurrentTransformationMatrix` to record
 * every matrix it's called with before delegating to the real
 * implementation. jsPDF's plugin methods are bound directly onto each
 * instance in its constructor, so a `class X extends jsPDF` override on the
 * prototype is shadowed by that instance property — patching after
 * construction is what actually intercepts the call `exportPdf` makes.
 */
function makeCtmSpyingPdfCtor(ctmMatrices) {
  return function SpyDoc(opts) {
    const doc = new jsPDF(opts);
    const real = doc.setCurrentTransformationMatrix.bind(doc);
    doc.setCurrentTransformationMatrix = (matrix) => {
      ctmMatrices.push({ a: matrix.sx, b: matrix.shy, c: matrix.shx, d: matrix.sy, e: matrix.tx, f: matrix.ty });
      return real(matrix);
    };
    return doc;
  };
}

describe("exportPdf tilt parity with the SVG preview convention (issue #24)", () => {
  it("produces a layout with at least one genuinely tilted card (sanity check on the fixture)", () => {
    const layoutResult = tiltedLayout();
    const tiltedCards = layoutResult.pages.flatMap((p) => p.cards).filter((c) => c.tiltDeg);
    expect(tiltedCards.length).toBeGreaterThan(0);
  });

  it("the PDF's CTM for each tilted card maps the tilt origin to itself in PDF space", () => {
    const layoutResult = tiltedLayout();

    const ctmMatrices = [];
    const doc = exportPdf(layoutResult, {
      fontFamily: COMIC_NEUE_FAMILY,
      fontBytes: comicNeueTtfBytes(),
      sizePt: 24,
      textColor: "#000000",
      PdfCtor: makeCtmSpyingPdfCtor(ctmMatrices),
    });

    const tiltedCards = layoutResult.pages.flatMap((p) => p.cards).filter((c) => c.tiltDeg);
    expect(ctmMatrices.length).toBe(tiltedCards.length);

    tiltedCards.forEach((card, i) => {
      const { a, b, c, d, e, f } = ctmMatrices[i];
      const ox = doc.internal.getHorizontalCoordinate(card.tiltOriginMm.xMm);
      const oy = doc.internal.getVerticalCoordinate(card.tiltOriginMm.yMm);

      const mappedX = a * ox + c * oy + e;
      const mappedY = b * ox + d * oy + f;

      // The tilt origin is the fixed point of its own rotation: a correct
      // CTM must map it to itself. The pre-#24 bug (raw-mm CTM, no mm->pt
      // scale, no Y-flip) fails this by tens to hundreds of points.
      expect(mappedX).toBeCloseTo(ox, 4);
      expect(mappedY).toBeCloseTo(oy, 4);
    });
  });

  it("the PDF's CTM maps each tilted card's inner-rect corners to the SAME PDF-space points the SVG rotate(deg,cx,cy) convention would (preview<->PDF parity)", () => {
    const layoutResult = tiltedLayout();

    const ctmMatrices = [];
    const doc = exportPdf(layoutResult, {
      fontFamily: COMIC_NEUE_FAMILY,
      fontBytes: comicNeueTtfBytes(),
      sizePt: 24,
      textColor: "#000000",
      PdfCtor: makeCtmSpyingPdfCtor(ctmMatrices),
    });

    const tiltedCards = layoutResult.pages.flatMap((p) => p.cards).filter((c) => c.tiltDeg);
    expect(tiltedCards.length).toBeGreaterThan(0);

    tiltedCards.forEach((card, i) => {
      const { a, b, c, d, e, f } = ctmMatrices[i];

      for (const cornerMm of rectCorners(card.innerRect)) {
        // "Preview" side: the SVG renderer's own rotate(tiltDeg, cx, cy)
        // contract, applied to the same mm point, then expressed in PDF space
        // using jsPDF's own converters (so both sides share one coordinate
        // system for the comparison).
        const expectedMm = svgRotateMm(cornerMm, card.tiltOriginMm, card.tiltDeg);
        const expectedPdfX = doc.internal.getHorizontalCoordinate(expectedMm.xMm);
        const expectedPdfY = doc.internal.getVerticalCoordinate(expectedMm.yMm);

        // "PDF" side: the UNROTATED mm point run through jsPDF's normal
        // (unrotated) coordinate conversion, then through the CTM actually
        // emitted for this card — exactly what happens when `doc.rect(...)`
        // draws this corner while that CTM is active.
        const startX = doc.internal.getHorizontalCoordinate(cornerMm.xMm);
        const startY = doc.internal.getVerticalCoordinate(cornerMm.yMm);
        const actualPdfX = a * startX + c * startY + e;
        const actualPdfY = b * startX + d * startY + f;

        expect(actualPdfX).toBeCloseTo(expectedPdfX, 4);
        expect(actualPdfY).toBeCloseTo(expectedPdfY, 4);
      }
    });
  });

  it("holds for the mat (outer border) rect too, across multiple pages (AC: 'mat + multi-page')", () => {
    const layoutResult = tiltedMattedMultiPageLayout();
    expect(layoutResult.pages.length).toBeGreaterThan(1);

    const ctmMatrices = [];
    const doc = exportPdf(layoutResult, {
      fontFamily: COMIC_NEUE_FAMILY,
      fontBytes: comicNeueTtfBytes(),
      sizePt: 24,
      textColor: "#000000",
      PdfCtor: makeCtmSpyingPdfCtor(ctmMatrices),
    });

    const tiltedCards = layoutResult.pages.flatMap((p) => p.cards).filter((c) => c.tiltDeg);
    expect(tiltedCards.length).toBeGreaterThan(0);
    expect(ctmMatrices.length).toBe(tiltedCards.length);

    // Each page can have its own height (and thus its own PDF-space Y-flip);
    // `doc.internal.getVerticalCoordinate` reads whichever page is currently
    // "active" on the doc, which sits on the LAST page by the time export
    // finishes. Switch back to each card's own page before computing its
    // expected coordinates, mirroring how `drawPage` draws page-by-page.
    let ctmIndex = 0;
    layoutResult.pages.forEach((page, pageIndex) => {
      doc.setPage(pageIndex + 1); // jsPDF pages are 1-indexed
      for (const card of page.cards) {
        if (!card.tiltDeg) continue;
        const { a, b, c, d, e, f } = ctmMatrices[ctmIndex];
        ctmIndex += 1;

        expect(card.outer?.visible).toBe(true);
        for (const rect of [card.innerRect, card.outerRect]) {
          for (const cornerMm of rectCorners(rect)) {
            const expectedMm = svgRotateMm(cornerMm, card.tiltOriginMm, card.tiltDeg);
            const expectedPdfX = doc.internal.getHorizontalCoordinate(expectedMm.xMm);
            const expectedPdfY = doc.internal.getVerticalCoordinate(expectedMm.yMm);

            const startX = doc.internal.getHorizontalCoordinate(cornerMm.xMm);
            const startY = doc.internal.getVerticalCoordinate(cornerMm.yMm);
            const actualPdfX = a * startX + c * startY + e;
            const actualPdfY = b * startX + d * startY + f;

            expect(actualPdfX).toBeCloseTo(expectedPdfX, 3);
            expect(actualPdfY).toBeCloseTo(expectedPdfY, 3);
          }
        }
      }
    });
  });
});
