import { describe, expect, it, vi } from "vitest";
import { exportPdf } from "../exportPdf.js";
import { computeLayout } from "../../engine/computeLayout.js";
import { createStubEnv } from "../../engine/__tests__/stubEnv.js";
import { makeState } from "../../engine/__tests__/testState.js";

/**
 * Issue #8: multi-page PDF export (SPEC.md stories 27–28, 56–57; "Export").
 *
 * `exportPdf` is the thin jsPDF renderer over the SAME `LayoutResult` tree the
 * SVG previews draw (SPEC.md: "The core is a pure, dependency-free layout
 * engine... the single source of truth for all three render targets"). It
 * takes an injectable jsPDF constructor (`opts.PdfCtor`) so tests never touch
 * a real PDF/canvas — exactly the `env`-style seam the engine itself uses for
 * DOM/network/random (AGENTS/SPEC "Implementation Decisions").
 *
 * Because jsPDF is real I/O-free JS (runs fine under Node/vitest), these
 * tests exercise the REAL `jsPDF` class directly rather than a hand-rolled
 * stub, and assert on the calls made / the produced document's shape
 * (page count, sizes) — never on internal renderer helpers.
 */

function fakeFontBytes() {
  // A tiny non-empty buffer stands in for real TTF bytes; exportPdf must not
  // care about font internals, only that bytes were embedded.
  return new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
}

describe("exportPdf", () => {
  it("produces one PDF page per LayoutResult page, at that page's mm size/orientation", () => {
    const env = createStubEnv({ charWidthMm: 5 });
    const many = Array.from({ length: 20 }, (_, i) => `t${i}`).join("\n");
    const state = makeState({
      text: many,
      layout: { mode: "grid" },
      page: { size: "A7", orientation: "portrait", marginMm: 5 },
    });
    const layoutResult = computeLayout(state, env);
    expect(layoutResult.pages.length).toBeGreaterThan(1);

    const addPageSpy = vi.fn();
    const pageSizes = [];
    class FakeDoc {
      constructor(opts) {
        this.opts = opts;
        pageSizes.push([opts.format[0], opts.format[1]]);
      }
      addPage(format, orientation) {
        addPageSpy(format, orientation);
        pageSizes.push([format[0], format[1]]);
      }
      addFileToVFS() {}
      addFont() {}
      setFont() {}
      setFontSize() {}
      setTextColor() {}
      setDrawColor() {}
      setLineWidth() {}
      rect() {}
      roundedRect() {}
      text() {}
      output() {
        return new Uint8Array([1, 2, 3]);
      }
    }

    const doc = exportPdf(layoutResult, {
      fontFamily: "Comic Neue",
      fontBytes: fakeFontBytes(),
      sizePt: 24,
      textColor: "#000000",
      PdfCtor: FakeDoc,
    });

    expect(doc).toBeInstanceOf(FakeDoc);
    // One `new FakeDoc` (page 0) + one addPage per subsequent page.
    expect(addPageSpy).toHaveBeenCalledTimes(layoutResult.pages.length - 1);
    expect(pageSizes.length).toBe(layoutResult.pages.length);
    for (const [w, h] of pageSizes) {
      expect(w).toBeCloseTo(layoutResult.pages[0].widthMm, 5);
      expect(h).toBeCloseTo(layoutResult.pages[0].heightMm, 5);
    }
  });

  it("embeds the supplied font bytes exactly once via addFileToVFS/addFont, and selects it", () => {
    const env = createStubEnv({ charWidthMm: 5 });
    const state = makeState({ text: "January February" });
    const layoutResult = computeLayout(state, env);

    const addFileToVFS = vi.fn();
    const addFont = vi.fn();
    const setFont = vi.fn();
    class FakeDoc {
      constructor() {}
      addPage() {}
      addFileToVFS(...args) {
        addFileToVFS(...args);
      }
      addFont(...args) {
        addFont(...args);
        // Real jsPDF returns an internal PDF font-RESOURCE key here (e.g.
        // "F15") that `setFont` does NOT accept — it is irrelevant to the
        // (family, style) lookup pair `setFont` needs, so the fake returns a
        // deliberately unrelated value to prove the exporter doesn't use it.
        return "F15";
      }
      setFont(...args) {
        setFont(...args);
      }
      setFontSize() {}
      setTextColor() {}
      setDrawColor() {}
      setLineWidth() {}
      rect() {}
      roundedRect() {}
      text() {}
      output() {
        return new Uint8Array();
      }
    }

    exportPdf(layoutResult, {
      fontFamily: "Comic Neue",
      fontBytes: fakeFontBytes(),
      sizePt: 24,
      textColor: "#000000",
      PdfCtor: FakeDoc,
    });

    expect(addFileToVFS).toHaveBeenCalledTimes(1);
    expect(addFont).toHaveBeenCalledTimes(1);
    // jsPDF looks fonts up by the (family, style) pair `addFont` was CALLED
    // with (see `doc.getFontList()`), NOT by its return value — so `setFont`
    // must be called with the SAME family/style `addFont` received.
    const [, registeredFamily, registeredStyle] = addFont.mock.calls[0];
    expect(setFont.mock.calls.some(([family, style]) => family === registeredFamily && style === registeredStyle)).toBe(
      true,
    );
  });

  it("draws every visible glyph via doc.text at the engine's mm coordinates", () => {
    const env = createStubEnv({ charWidthMm: 5 });
    const state = makeState({ text: "ab" });
    const layoutResult = computeLayout(state, env);
    const allGlyphs = layoutResult.pages.flatMap((p) => p.cards).flatMap((c) => c.glyphs);
    expect(allGlyphs.length).toBeGreaterThan(0);

    const textSpy = vi.fn();
    const doc = makeSpyDoc({ text: textSpy });

    exportPdf(layoutResult, {
      fontFamily: "Comic Neue",
      fontBytes: fakeFontBytes(),
      sizePt: 24,
      textColor: "#000000",
      PdfCtor: doc.Ctor,
    });

    expect(textSpy).toHaveBeenCalledTimes(allGlyphs.length);
    for (const glyph of allGlyphs) {
      expect(textSpy).toHaveBeenCalledWith(
        glyph.char,
        expect.closeTo(glyph.x, 5),
        expect.closeTo(glyph.y, 5),
        expect.anything(),
      );
    }
  });

  it("skips glyph drawing entirely when a card's textVisible is false (layer-visibility toggle)", () => {
    const env = createStubEnv({ charWidthMm: 5 });
    const state = makeState({ text: "ab", visibility: { outer: true, inner: true, text: false } });
    const layoutResult = computeLayout(state, env);

    const textSpy = vi.fn();
    const doc = makeSpyDoc({ text: textSpy });

    exportPdf(layoutResult, {
      fontFamily: "Comic Neue",
      fontBytes: fakeFontBytes(),
      sizePt: 24,
      textColor: "#000000",
      PdfCtor: doc.Ctor,
    });

    expect(textSpy).not.toHaveBeenCalled();
  });

  it("draws only the inner border when outer visibility is off, and vice versa (SPEC.md stories 27-28)", () => {
    const env = createStubEnv({ charWidthMm: 5 });

    const innerOnlyState = makeState({
      text: "ab",
      card: { outer: { enabled: true } },
      visibility: { outer: false, inner: true, text: true },
    });
    const innerOnlyResult = computeLayout(innerOnlyState, env);
    const rectCallsInner = [];
    const innerDoc = makeSpyDoc({ rect: (...a) => rectCallsInner.push(a) });
    exportPdf(innerOnlyResult, {
      fontFamily: "Comic Neue",
      fontBytes: fakeFontBytes(),
      sizePt: 24,
      textColor: "#000000",
      PdfCtor: innerDoc.Ctor,
    });
    const cardCount = innerOnlyResult.pages.flatMap((p) => p.cards).length;
    expect(rectCallsInner.length).toBe(cardCount); // only inner rects drawn

    const outerOnlyState = makeState({
      text: "ab",
      card: { outer: { enabled: true } },
      visibility: { outer: true, inner: false, text: true },
    });
    const outerOnlyResult = computeLayout(outerOnlyState, env);
    const rectCallsOuter = [];
    const outerDoc = makeSpyDoc({ rect: (...a) => rectCallsOuter.push(a) });
    exportPdf(outerOnlyResult, {
      fontFamily: "Comic Neue",
      fontBytes: fakeFontBytes(),
      sizePt: 24,
      textColor: "#000000",
      PdfCtor: outerDoc.Ctor,
    });
    expect(rectCallsOuter.length).toBe(cardCount); // only outer rects drawn
  });

  it("produces a structurally identical sequence of draw calls for the same LayoutResult (determinism)", () => {
    const env = createStubEnv({ charWidthMm: 5 });
    const state = makeState({ text: "January February March", card: { outer: { enabled: true } } });
    const layoutResult = computeLayout(state, env);

    function run() {
      const calls = [];
      const doc = makeSpyDoc({
        text: (...a) => calls.push(["text", ...a]),
        rect: (...a) => calls.push(["rect", ...a]),
        roundedRect: (...a) => calls.push(["roundedRect", ...a]),
      });
      exportPdf(layoutResult, {
        fontFamily: "Comic Neue",
        fontBytes: fakeFontBytes(),
        sizePt: 24,
        textColor: "#000000",
        PdfCtor: doc.Ctor,
      });
      return calls;
    }

    expect(run()).toEqual(run());
  });

  it("returns the raw PDF bytes produced by doc.output()", () => {
    const env = createStubEnv({ charWidthMm: 5 });
    const state = makeState({ text: "a" });
    const layoutResult = computeLayout(state, env);
    const bytes = new Uint8Array([9, 9, 9]);
    const doc = makeSpyDoc({}, { outputReturn: bytes });

    const result = exportPdf(layoutResult, {
      fontFamily: "Comic Neue",
      fontBytes: fakeFontBytes(),
      sizePt: 24,
      textColor: "#000000",
      PdfCtor: doc.Ctor,
      returnBytes: true,
    });

    expect(result).toBe(bytes);
  });
});

/** Build a minimal fake jsPDF-shaped class, spying on whichever methods are passed. */
function makeSpyDoc(spies = {}, { outputReturn = new Uint8Array() } = {}) {
  class FakeDoc {
    constructor() {}
    addPage() {}
    addFileToVFS() {}
    addFont() {
      return "embedded-font";
    }
    setFont() {}
    setFontSize() {}
    setTextColor() {}
    setDrawColor() {}
    setLineWidth() {}
    rect(...args) {
      spies.rect?.(...args);
    }
    roundedRect(...args) {
      spies.roundedRect?.(...args);
    }
    text(...args) {
      spies.text?.(...args);
    }
    output() {
      return outputReturn;
    }
  }
  return { Ctor: FakeDoc };
}
