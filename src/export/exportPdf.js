import { jsPDF } from "jspdf";
import { pdfTiltMatrixParams } from "../render/cardTiltTransform.js";

/**
 * Thin jsPDF renderer over a `LayoutResult` (see `../engine/computeLayout.js`).
 * It draws the SAME tree the SVG previews draw and computes NO layout
 * geometry of its own — it only translates the engine's mm coordinates and
 * per-card/per-glyph rotations into jsPDF drawing calls (SPEC.md: "The...
 * jsPDF exporter [is a] thin renderer over this same tree", story 56: "a
 * single Download PDF button... draws the same LayoutResult tree the
 * previews use").
 *
 * One jsPDF page is emitted per `LayoutResult` page, each sized/oriented to
 * that page's own mm dimensions (`page.widthMm`/`heightMm`) — pages need not
 * share a size (the engine always emits the project's one paper size today,
 * but the exporter makes no such assumption, mirroring `renderSvgPreview`).
 *
 * Layer visibility (SPEC.md stories 27–28) and text visibility are read
 * straight off each card exactly as the SVG renderer reads them (`inner`/
 * `outer` carry `visible`; `textVisible` gates glyphs) — no new visibility
 * logic here, just honouring flags the engine already computed.
 *
 * Rotation: a card's per-glyph `rotationDeg` is passed straight to jsPDF's
 * `text(...,{angle})`, which (empirically verified against the SVG
 * renderer's `rotate(deg, cx, cy)`) rotates in the SAME visual direction with
 * NO sign change needed. A card's `tiltDeg` (rotating the WHOLE card body —
 * both borders and every glyph — about `tiltOriginMm`, exactly as
 * `renderSvgPreview`'s `<g transform="rotate(...)">` does) is instead applied
 * as a graphics-state CTM around that card's draws, via the SHARED
 * `pdfTiltMatrixParams` (`../render/cardTiltTransform.js`) — the one place
 * that derives a PDF `cm` matrix landing at the same points the SVG
 * renderer's mm-space `rotate(deg, cx, cy)` would (issue #24: `cm` operates
 * in raw PDF user space — points, Y-up — NOT the engine's mm/Y-down space, so
 * naively reusing `tiltOriginMm` there rotates about the wrong point and the
 * card swings out of its grid cell; see that module's doc for the full
 * derivation).
 *
 * @param {{ pages: Array<{ widthMm:number, heightMm:number, cards: Array<object> }> }} layoutResult
 * @param {{
 *   fontFamily: string,
 *   fontBytes: Uint8Array,
 *   sizePt?: number,
 *   textColor?: string,
 *   PdfCtor?: typeof jsPDF,
 *   returnBytes?: boolean,
 * }} opts
 * @returns {import("jspdf").jsPDF | ArrayBuffer} the jsPDF document, or (when
 *   `opts.returnBytes` is true) the raw PDF bytes from
 *   `doc.output("arraybuffer")` — jsPDF's bare `output()` returns its
 *   internal binary STRING representation, which is awkward for callers
 *   (browser `Blob`/download, or byte-level assertions here), so this option
 *   always asks for the `arraybuffer` form instead.
 */
export function exportPdf(layoutResult, opts) {
  const { fontFamily, fontBytes, sizePt = 24, textColor = "#000000", PdfCtor = jsPDF, returnBytes = false } = opts;
  const pages = layoutResult?.pages ?? [];
  const firstPage = pages[0] ?? { widthMm: 210, heightMm: 297 };

  const doc = new PdfCtor({
    unit: "mm",
    format: [firstPage.widthMm, firstPage.heightMm],
    orientation: firstPage.widthMm > firstPage.heightMm ? "landscape" : "portrait",
  });

  const embeddedFont = embedFont(doc, fontFamily, fontBytes);

  pages.forEach((page, index) => {
    if (index > 0) {
      doc.addPage([page.widthMm, page.heightMm], page.widthMm > page.heightMm ? "landscape" : "portrait");
    }
    drawPage(doc, page, { embeddedFont, sizePt, textColor });
  });

  return returnBytes ? doc.output("arraybuffer") : doc;
}

const FONT_STYLE = "normal";

/**
 * Registers the caller-supplied TTF bytes as a jsPDF virtual file + font, and
 * selects it as the active font (SPEC.md story 51 / Fonts: "the exact chosen
 * font embedded in the PDF... embedded font, not a jsPDF built-in). Runs
 * once, before any page draws, so every glyph on every page uses it.
 *
 * NOTE: `doc.addFont(vfsFileName, family, style)` returns an internal PDF
 * font-RESOURCE key (e.g. "F15"), not something `setFont` accepts — jsPDF
 * looks fonts up by the (family, style) pair `addFont` was CALLED with (see
 * `doc.getFontList()`), so `setFont` must be called with those same two
 * strings, not `addFont`'s return value (verified against the real jsPDF:
 * passing the return value logs "Unable to look up font label" and silently
 * falls back to a built-in font).
 */
function embedFont(doc, fontFamily, fontBytes) {
  const vfsFileName = `${fontFamily}.ttf`;
  const base64 = bytesToBase64(fontBytes);
  doc.addFileToVFS(vfsFileName, base64);
  doc.addFont(vfsFileName, fontFamily, FONT_STYLE);
  doc.setFont(fontFamily, FONT_STYLE);
  return { family: fontFamily, style: FONT_STYLE };
}

/** Draw one LayoutResult page's cards onto the CURRENT jsPDF page. */
function drawPage(doc, page, { embeddedFont, sizePt, textColor }) {
  doc.setFont(embeddedFont.family, embeddedFont.style);
  doc.setFontSize(sizePt);
  doc.setTextColor(textColor);

  for (const card of page.cards ?? []) {
    const tilted = card.tiltDeg && card.tiltOriginMm;
    if (tilted) doc.saveGraphicsState();
    if (tilted) applyTiltCtm(doc, card.tiltDeg, card.tiltOriginMm);

    if (card.outer?.visible) drawBorder(doc, card.outerRect, card.outer);
    if (card.inner?.visible !== false) drawBorder(doc, card.innerRect, card.inner);
    if (card.textVisible !== false) {
      for (const glyph of card.glyphs ?? []) drawGlyph(doc, glyph);
    }

    if (tilted) doc.restoreGraphicsState();
  }
}

function drawBorder(doc, rect, style = {}) {
  doc.setDrawColor(style.color ?? "#000000");
  doc.setLineWidth(style.strokeMm ?? 0.5);
  if (style.radiusMm) {
    doc.roundedRect(rect.xMm, rect.yMm, rect.widthMm, rect.heightMm, style.radiusMm, style.radiusMm, "S");
  } else {
    doc.rect(rect.xMm, rect.yMm, rect.widthMm, rect.heightMm, "S");
  }
}

function drawGlyph(doc, glyph) {
  const options = glyph.rotationDeg ? { angle: glyph.rotationDeg } : {};
  doc.text(glyph.char, glyph.x, glyph.y, options);
}

/**
 * Wraps the current graphics state in a rotation-about-`originMm` CTM, the
 * PDF-native equivalent of the SVG renderer's per-card
 * `<g transform="rotate(deg cx cy)">` group. Delegates the actual matrix
 * derivation to the shared `pdfTiltMatrixParams` (see module doc + that
 * function's doc for why raw mm coordinates can't be used directly here).
 */
function applyTiltCtm(doc, tiltDeg, originMm) {
  const { a, b, c, d, e, f } = pdfTiltMatrixParams(
    { tiltDeg, originMm },
    {
      toPdfX: (xMm) => doc.internal.getHorizontalCoordinate(xMm),
      toPdfY: (yMm) => doc.internal.getVerticalCoordinate(yMm),
    },
  );
  doc.setCurrentTransformationMatrix(doc.Matrix(a, b, c, d, e, f));
}

function bytesToBase64(bytes) {
  if (typeof btoa === "function") {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  // eslint-disable-next-line no-undef -- Node test environment fallback only.
  return Buffer.from(bytes).toString("base64");
}
