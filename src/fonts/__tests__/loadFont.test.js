import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { loadFont } from "../loadFont.js";
import { comicNeueTtfBytes } from "../comicNeue.js";

/**
 * Integration tests for the font pipeline's orchestrator (SPEC.md Testing
 * Decisions: "a small number of integration checks (fetch -> decode -> embed
 * produces a valid font)"). Network and `FontFace` are injected fakes (no
 * real network calls at test time) but the real woff2 decoder runs for the
 * custom-font path, using the same checked-in fixture as
 * `decodeWoff2ToTtf.test.js` — so a real break in fetch->decode wiring fails
 * here, not just a mock-satisfying stub.
 */
const yuyuWoff2 = readFileSync(new URL("./fixtures/yuyu-sample.woff2", import.meta.url));

function fakeTtfResponse(bytes) {
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => (name === "Content-Length" ? String(bytes.length) : null) },
    body: undefined, // exercise the non-streaming arrayBuffer() fallback path
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}

function fakeCssResponse(css) {
  return { ok: true, status: 200, text: async () => css };
}

class FakeFontFaceSet {
  constructor() {
    this.added = [];
  }
  add(face) {
    this.added.push(face);
  }
}

class FakeFontFace {
  constructor(family, src) {
    this.family = family;
    this.src = src;
  }
  async load() {
    return this;
  }
}

describe("loadFont", () => {
  it("resolves the builtin default with no network calls and registers its FontFace", async () => {
    const fetchImpl = vi.fn();
    const fontFaceSet = new FakeFontFaceSet();
    const progress = [];

    const result = await loadFont(
      { family: "Comic Neue", source: "builtin" },
      { onProgress: (p) => progress.push(p), fetchImpl, fontFaceSet, FontFaceCtor: FakeFontFace },
    );

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.family).toBe("Comic Neue");
    expect(result.source).toBe("builtin");
    expect(result.ttfBytes.length).toBe(comicNeueTtfBytes().length);
    expect(fontFaceSet.added).toHaveLength(1);
    expect(fontFaceSet.added[0].family).toBe("Comic Neue");
    expect(progress.length).toBeGreaterThan(0);
  });

  it("fetches a curated font's TTF directly (no decode step) and reports progress", async () => {
    const ttfBytes = comicNeueTtfBytes(); // stand-in TTF payload for a curated fetch
    const fetchImpl = vi.fn(async (url) => {
      expect(url).toBe("https://cdn.jsdelivr.net/fontsource/fonts/yuyu@latest/latin-400-normal.ttf");
      return fakeTtfResponse(ttfBytes);
    });
    const fontFaceSet = new FakeFontFaceSet();
    const progress = [];

    const result = await loadFont(
      { family: "Yuyu", source: "curated" },
      { onProgress: (p) => progress.push(p), fetchImpl, fontFaceSet, FontFaceCtor: FakeFontFace },
    );

    expect(result.source).toBe("curated");
    expect(result.family).toBe("Yuyu");
    expect(result.ttfBytes.length).toBe(ttfBytes.length);
    expect(progress.at(-1)).toEqual({ loadedBytes: ttfBytes.length, totalBytes: ttfBytes.length });
    expect(fontFaceSet.added[0].family).toBe("Yuyu");
  });

  it("falls back to the Google Fonts CSS API + decode when a curated font isn't on Fontsource (e.g. Yuyu)", async () => {
    const css = `
      @font-face {
        font-family: 'Yuyu';
        src: url(https://fonts.gstatic.com/s/yuyu/v1/cY9Kfj2VT1Zd2UTkMw.woff2) format('woff2');
      }
    `;
    const fetchImpl = vi.fn(async (url) => {
      if (url.includes("jsdelivr.net")) return { ok: false, status: 404 };
      if (url.includes("fonts.googleapis.com")) return fakeCssResponse(css);
      if (url.includes("fonts.gstatic.com")) return fakeTtfResponse(yuyuWoff2);
      throw new Error(`unexpected fetch: ${url}`);
    });
    const fontFaceSet = new FakeFontFaceSet();

    const result = await loadFont(
      { family: "Yuyu", source: "curated" },
      { fetchImpl, fontFaceSet, FontFaceCtor: FakeFontFace },
    );

    expect(result.source).toBe("curated");
    expect(result.family).toBe("Yuyu");
    // Real decoded sfnt TTF via the fallback path, not a raw woff2 passthrough.
    expect(Array.from(result.ttfBytes.slice(0, 4))).toEqual([0x00, 0x01, 0x00, 0x00]);
    expect(fontFaceSet.added[0].family).toBe("Yuyu");
  });

  it("resolves a custom Google Font: CSS API -> woff2 -> real lazy decode -> valid TTF", async () => {
    const css = `
      @font-face {
        font-family: 'Yuyu';
        src: url(https://fonts.gstatic.com/s/yuyu/v1/cY9Kfj2VT1Zd2UTkMw.woff2) format('woff2');
      }
    `;
    const fetchImpl = vi.fn(async (url) => {
      if (url.includes("fonts.googleapis.com")) return fakeCssResponse(css);
      if (url.includes("fonts.gstatic.com")) return fakeTtfResponse(yuyuWoff2);
      throw new Error(`unexpected fetch: ${url}`);
    });
    const fontFaceSet = new FakeFontFaceSet();

    const result = await loadFont(
      { family: "Yuyu", source: "custom" },
      { fetchImpl, fontFaceSet, FontFaceCtor: FakeFontFace },
    );

    expect(result.source).toBe("custom");
    expect(result.family).toBe("Yuyu");
    // Real decoded sfnt TTF, not the raw woff2 passthrough.
    expect(Array.from(result.ttfBytes.slice(0, 4))).toEqual([0x00, 0x01, 0x00, 0x00]);
    expect(fontFaceSet.added[0].family).toBe("Yuyu");
  });

  it("falls back to the Fontsource TTF when the Google Fonts CSS API is unreachable", async () => {
    const ttfBytes = comicNeueTtfBytes();
    const fetchImpl = vi.fn(async (url) => {
      if (url.includes("fonts.googleapis.com")) return { ok: false, status: 500 };
      if (url.includes("jsdelivr.net")) return fakeTtfResponse(ttfBytes);
      throw new Error(`unexpected fetch: ${url}`);
    });

    const result = await loadFont(
      { family: "Some Odd Family", source: "custom" },
      { fetchImpl, fontFaceSet: new FakeFontFaceSet(), FontFaceCtor: FakeFontFace },
    );

    expect(result.source).toBe("custom");
    expect(result.ttfBytes.length).toBe(ttfBytes.length);
  });

  it("is a no-op FontFace registration when no FontFace/document.fonts is available (safe under plain Node)", async () => {
    const fetchImpl = vi.fn();
    await expect(
      loadFont({ family: "Comic Neue", source: "builtin" }, { fetchImpl, fontFaceSet: undefined, FontFaceCtor: undefined }),
    ).resolves.toMatchObject({ family: "Comic Neue" });
  });
});
