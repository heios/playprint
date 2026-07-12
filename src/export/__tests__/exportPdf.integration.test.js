import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { exportPdf } from "../exportPdf.js";
import { computeLayout } from "../../engine/computeLayout.js";
import { createStubEnv } from "../../engine/__tests__/stubEnv.js";
import { makeState } from "../../engine/__tests__/testState.js";
import { comicNeueTtfBytes, COMIC_NEUE_FAMILY } from "../../fonts/comicNeue.js";

/**
 * Integration test for the PDF exporter (SPEC.md Testing Decisions: "a small
 * number of integration checks (fetch -> decode -> embed produces a valid
 * font in the PDF)" / issue #8 acceptance criterion: "fetch -> decode ->
 * embed produces a valid, correctly-rendered font in the output PDF").
 *
 * Unlike `exportPdf.test.js` (which injects a fake jsPDF to unit-test the
 * exporter's call sequence in isolation), this test runs the REAL `jsPDF`
 * class end-to-end with the REAL embedded Comic Neue TTF bytes (the same
 * bytes `loadFont` resolves for the builtin/offline default — SPEC.md story
 * 48), and asserts on the actual produced PDF bytes: a well-formed PDF
 * that embeds the font (not silently falling back to a built-in jsPDF font).
 */
describe("exportPdf (real jsPDF integration)", () => {
  it("produces a valid multi-page PDF with the real font embedded", () => {
    const env = createStubEnv({ charWidthMm: 5 });
    const state = makeState({ text: "January February\nMarch" });
    const layoutResult = computeLayout(state, env);
    expect(layoutResult.pages.length).toBeGreaterThan(0);

    const fontBytes = comicNeueTtfBytes();
    expect(fontBytes.length).toBeGreaterThan(0);

    const bytes = exportPdf(layoutResult, {
      fontFamily: COMIC_NEUE_FAMILY,
      fontBytes,
      sizePt: 24,
      textColor: "#000000",
      PdfCtor: jsPDF,
      returnBytes: true,
    });

    const pdfString = bytesToLatin1String(bytes);

    // A well-formed PDF: standard header/trailer markers.
    expect(pdfString.startsWith("%PDF-1.")).toBe(true);
    expect(pdfString).toContain("%%EOF");

    // The font is actually EMBEDDED (a FontFile2 stream, the TrueType
    // embedding convention) rather than silently falling back to one of
    // jsPDF's built-in fonts (Helvetica/Times/Courier), and named in the PDF
    // as the embedded family (PDF name objects escape spaces as `#20`).
    expect(pdfString).toContain("FontFile2");
    expect(pdfString).toContain(`/BaseFont /${COMIC_NEUE_FAMILY.replace(/ /g, "#20")}`);

    // One PDF page object per LayoutResult page.
    const pageObjectMatches = pdfString.match(/\/Type\s*\/Page[^s]/g) ?? [];
    expect(pageObjectMatches.length).toBe(layoutResult.pages.length);
  });

  it("round-trips visible text glyphs into the PDF's content stream", () => {
    const env = createStubEnv({ charWidthMm: 5 });
    const state = makeState({ text: "hi" });
    const layoutResult = computeLayout(state, env);

    const bytes = exportPdf(layoutResult, {
      fontFamily: COMIC_NEUE_FAMILY,
      fontBytes: comicNeueTtfBytes(),
      sizePt: 24,
      textColor: "#000000",
      PdfCtor: jsPDF,
      returnBytes: true,
    });

    const pdfString = bytesToLatin1String(bytes);
    // jsPDF's default embedded-TTF text encoding is a CID/Identity-H stream
    // (glyph-index hex strings, not raw ASCII) -- assert the content stream
    // carries a `Tj`/`TJ` show-text operator per glyph rather than trying to
    // pattern-match literal characters through that encoding.
    const showTextOps = pdfString.match(/[\s>)]Tj/g) ?? [];
    expect(showTextOps.length).toBeGreaterThanOrEqual(2); // "h" and "i"
  });
});

function bytesToLatin1String(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let out = "";
  const chunk = 0x8000;
  for (let i = 0; i < arr.length; i += chunk) {
    out += String.fromCharCode(...arr.subarray(i, i + chunk));
  }
  return out;
}
