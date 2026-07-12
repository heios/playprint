import { describe, expect, it } from "vitest";
import { CURATED_FONTS, findCuratedFontByFamily, fontsourceTtfUrl } from "../curatedFonts.js";

/**
 * Pure-data tests for the curated font registry (SPEC.md Fonts: "curated
 * set: Schoolbell, Twinkle Star, Yuyu, Playpen Sans, Coming Soon, Patrick
 * Hand, Short Stack"). No network/DOM here — thumbnails are pre-baked data,
 * so this whole module is synchronous and unit-testable like any other pure
 * data module in the codebase.
 */
describe("curatedFonts", () => {
  const EXPECTED_FAMILIES = [
    "Schoolbell",
    "Twinkle Star",
    "Yuyu",
    "Playpen Sans",
    "Coming Soon",
    "Patrick Hand",
    "Short Stack",
  ];

  it("lists exactly the seven curated families from the spec, in order", () => {
    expect(CURATED_FONTS.map((f) => f.family)).toEqual(EXPECTED_FAMILIES);
  });

  it("gives every curated font a pre-baked PNG data URI thumbnail (available with no fetch)", () => {
    for (const font of CURATED_FONTS) {
      expect(font.thumbnailDataUri).toMatch(/^data:image\/png;base64,/);
      // Real bytes, not an empty placeholder.
      expect(font.thumbnailDataUri.length).toBeGreaterThan(100);
    }
  });

  it("every curated font resolves to a distinct jsDelivr Fontsource TTF URL", () => {
    const urls = CURATED_FONTS.map((f) => fontsourceTtfUrl(f.fontsourceId));
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) {
      expect(url).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/fontsource\/fonts\/.+\/latin-400-normal\.ttf$/);
    }
  });

  it("findCuratedFontByFamily resolves a known family and returns undefined for a custom one", () => {
    expect(findCuratedFontByFamily("Yuyu")?.fontsourceId).toBe("yuyu");
    expect(findCuratedFontByFamily("Some Random Google Font")).toBeUndefined();
  });
});
