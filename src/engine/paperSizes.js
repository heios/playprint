// @ts-check
/**
 * Paper dimensions in mm (portrait: width < height), per SPEC.md story 42
 * (ISO A0–A10, B0–B10, plus US Letter/Legal/Tabloid). The engine reads this
 * to size each page's mm viewBox; the renderer never computes dimensions.
 */
const A = [
  [841, 1189], [594, 841], [420, 594], [297, 420], [210, 297],
  [148, 210], [105, 148], [74, 105], [52, 74], [37, 52], [26, 37],
];
const B = [
  [1000, 1414], [707, 1000], [500, 707], [353, 500], [250, 353],
  [176, 250], [125, 176], [88, 125], [62, 88], [44, 62], [31, 44],
];

/** @type {Record<string, { widthMm: number, heightMm: number }>} */
const SIZES = {};
A.forEach(([w, h], i) => (SIZES[`A${i}`] = { widthMm: w, heightMm: h }));
B.forEach(([w, h], i) => (SIZES[`B${i}`] = { widthMm: w, heightMm: h }));
SIZES.Letter = { widthMm: 215.9, heightMm: 279.4 };
SIZES.Legal = { widthMm: 215.9, heightMm: 355.6 };
SIZES.Tabloid = { widthMm: 279.4, heightMm: 431.8 };
SIZES.A4 = { widthMm: 210, heightMm: 297 };

export const PAPER_SIZES = SIZES;

/**
 * Resolve a page's outer dimensions in mm for the given size + orientation.
 * @param {{ size?: string, orientation?: "portrait"|"landscape" }} page
 * @returns {{ widthMm: number, heightMm: number }}
 */
export function pageDimensionsMm({ size = "A4", orientation = "portrait" } = {}) {
  const base = SIZES[size] ?? SIZES.A4;
  return orientation === "landscape"
    ? { widthMm: base.heightMm, heightMm: base.widthMm }
    : { widthMm: base.widthMm, heightMm: base.heightMm };
}
