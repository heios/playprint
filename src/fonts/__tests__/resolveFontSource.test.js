import { describe, expect, it } from "vitest";
import { resolveFontSource, googleFontsCssUrl, slugifyFamily } from "../resolveFontSource.js";

/**
 * Pure unit tests for the font-source resolver (no network/DOM): given a
 * `card.font` spec it decides builtin vs. curated vs. custom and produces the
 * right URLs, without performing any I/O itself (SPEC.md: "Font resolution
 * sits behind a thin adapter... network kept out of the pure engine").
 */
describe("resolveFontSource", () => {
  it("resolves the default/empty font to builtin (Comic Neue, no fetch)", () => {
    expect(resolveFontSource(undefined)).toEqual({ kind: "builtin" });
    expect(resolveFontSource({ family: "Comic Neue", source: "builtin" })).toEqual({ kind: "builtin" });
  });

  it("resolves a curated family to its jsDelivr Fontsource TTF URL", () => {
    const result = resolveFontSource({ family: "Yuyu", source: "curated" });
    expect(result.kind).toBe("curated");
    expect(result.family).toBe("Yuyu");
    expect(result.ttfUrl).toBe("https://cdn.jsdelivr.net/fontsource/fonts/yuyu@latest/latin-400-normal.ttf");
  });

  it("recognizes a curated family even without an explicit source flag", () => {
    const result = resolveFontSource({ family: "Patrick Hand" });
    expect(result.kind).toBe("curated");
  });

  it("honours an explicit source:'custom' even for a family name that also happens to be curated", () => {
    // A maker who types "Yuyu" into the free-text custom box gets the custom
    // (Google Fonts API) path, not silently redirected to the curated one.
    const result = resolveFontSource({ family: "Yuyu", source: "custom" });
    expect(result.kind).toBe("custom");
  });

  it("throws for a source:'curated' family that isn't in the curated set", () => {
    expect(() => resolveFontSource({ family: "Not Curated", source: "curated" })).toThrow();
  });

  it("resolves an arbitrary family name to custom, with a Google Fonts CSS API URL and a Fontsource fallback", () => {
    const result = resolveFontSource({ family: "Bangers", source: "custom" });
    expect(result.kind).toBe("custom");
    expect(result.family).toBe("Bangers");
    expect(result.cssApiUrl).toContain("fonts.googleapis.com/css2");
    expect(result.cssApiUrl).toContain("family=Bangers");
    expect(result.fallbackTtfUrl).toBe("https://cdn.jsdelivr.net/fontsource/fonts/bangers@latest/latin-400-normal.ttf");
  });

  it("googleFontsCssUrl encodes spaces as '+' (the API's expected form)", () => {
    expect(googleFontsCssUrl("Twinkle Star")).toContain("family=Twinkle+Star");
  });

  it("slugifyFamily kebab-cases arbitrary family names for the Fontsource fallback", () => {
    expect(slugifyFamily("Playpen Sans")).toBe("playpen-sans");
    expect(slugifyFamily("  Some_Weird.Name!! ")).toBe("some-weird-name");
  });
});
