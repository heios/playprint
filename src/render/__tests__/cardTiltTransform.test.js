import { describe, expect, it } from "vitest";
import { pdfTiltMatrixParams } from "../cardTiltTransform.js";

/**
 * Issue #24: renderer parity. `pdfTiltMatrixParams` must produce a PDF CTM
 * that, when applied to a point already converted to PDF space (points,
 * Y-up, via the SAME `toPdfX`/`toPdfY` converters the caller used), lands at
 * the SAME visual location as the SVG renderer's native
 * `rotate(tiltDeg, cx, cy)` (mm, Y-down) applied to that point, then
 * converted to PDF space. This is the actual contract `exportPdf.js` needs:
 * "rotate about `tiltOriginMm` the same way the SVG preview does."
 */

// A stand-in for jsPDF's `doc.internal.getHorizontalCoordinate` /
// `getVerticalCoordinate`: mm -> pt scale, and a per-page Y-flip.
function makeConverters({ k = 2.834645669, pageHeightMm = 297 } = {}) {
  const pageHeightPt = pageHeightMm * k;
  return {
    toPdfX: (xMm) => k * xMm,
    toPdfY: (yMm) => pageHeightPt - k * yMm,
    k,
    pageHeightPt,
  };
}

/** Reference: SVG's rotate(deg, cx, cy) in mm/Y-down space. */
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

/** Apply a jsPDF-style affine matrix { a,b,c,d,e,f } to a PDF-space point. */
function applyMatrix({ a, b, c, d, e, f }, x, y) {
  return { x: a * x + c * y + e, y: b * x + d * y + f };
}

describe("pdfTiltMatrixParams", () => {
  it("maps the tilt origin to itself (fixed point of the rotation)", () => {
    const { toPdfX, toPdfY } = makeConverters();
    const originMm = { xMm: 40, yMm: 60 };
    const matrix = pdfTiltMatrixParams({ tiltDeg: 12, originMm }, { toPdfX, toPdfY });

    const ox = toPdfX(originMm.xMm);
    const oy = toPdfY(originMm.yMm);
    const mapped = applyMatrix(matrix, ox, oy);

    expect(mapped.x).toBeCloseTo(ox, 6);
    expect(mapped.y).toBeCloseTo(oy, 6);
  });

  it("agrees with the SVG rotate(deg, cx, cy) convention for arbitrary points, in PDF space", () => {
    const { toPdfX, toPdfY } = makeConverters({ pageHeightMm: 148 }); // A5 landscape-ish height
    const originMm = { xMm: 55, yMm: 70 };
    const tiltDeg = 18;
    const matrix = pdfTiltMatrixParams({ tiltDeg, originMm }, { toPdfX, toPdfY });

    const testPointsMm = [
      { xMm: 55, yMm: 70 }, // the origin itself
      { xMm: 40, yMm: 50 }, // a rect corner, above-left
      { xMm: 70, yMm: 50 },
      { xMm: 70, yMm: 90 },
      { xMm: 40, yMm: 90 },
      { xMm: 58, yMm: 65 }, // a glyph position
    ];

    for (const pointMm of testPointsMm) {
      const expectedMm = svgRotateMm(pointMm, originMm, tiltDeg);
      const expectedPdf = { x: toPdfX(expectedMm.xMm), y: toPdfY(expectedMm.yMm) };

      const startPdf = { x: toPdfX(pointMm.xMm), y: toPdfY(pointMm.yMm) };
      const actualPdf = applyMatrix(matrix, startPdf.x, startPdf.y);

      expect(actualPdf.x).toBeCloseTo(expectedPdf.x, 5);
      expect(actualPdf.y).toBeCloseTo(expectedPdf.y, 5);
    }
  });

  it("is the identity matrix when tiltDeg is 0 (no rotation, no drift)", () => {
    const { toPdfX, toPdfY } = makeConverters();
    const originMm = { xMm: 20, yMm: 30 };
    const matrix = pdfTiltMatrixParams({ tiltDeg: 0, originMm }, { toPdfX, toPdfY });

    expect(matrix.a).toBeCloseTo(1, 10);
    expect(matrix.b).toBeCloseTo(0, 10);
    expect(matrix.c).toBeCloseTo(0, 10);
    expect(matrix.d).toBeCloseTo(1, 10);
    expect(matrix.e).toBeCloseTo(0, 10);
    expect(matrix.f).toBeCloseTo(0, 10);
  });

  it("a negative tilt rotates the opposite visual direction from a positive one", () => {
    const { toPdfX, toPdfY } = makeConverters();
    const originMm = { xMm: 30, yMm: 30 };
    const pointMm = { xMm: 50, yMm: 30 };

    const plus = pdfTiltMatrixParams({ tiltDeg: 10, originMm }, { toPdfX, toPdfY });
    const minus = pdfTiltMatrixParams({ tiltDeg: -10, originMm }, { toPdfX, toPdfY });

    const start = { x: toPdfX(pointMm.xMm), y: toPdfY(pointMm.yMm) };
    const plusResult = applyMatrix(plus, start.x, start.y);
    const minusResult = applyMatrix(minus, start.x, start.y);

    // Both displace the point from its start, in opposite Y directions (the
    // sign is PDF-space's, i.e. Y-up, which is inverted from mm/Y-down).
    expect(plusResult.y - start.y).toBeLessThan(-0.01);
    expect(minusResult.y - start.y).toBeGreaterThan(0.01);
  });
});
