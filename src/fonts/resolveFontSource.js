import { COMIC_NEUE_FAMILY } from "./comicNeue.js";
import { findCuratedFontByFamily, fontsourceTtfUrl } from "./curatedFonts.js";

/**
 * Pure resolver: given a `card.font` spec (SPEC.md `state.card.font: { family,
 * source }`), decides WHERE its TTF bytes come from and whether a woff2->TTF
 * decode step is needed. No fetch happens here — this is the thin, testable
 * seam between "what font is selected" and the actual I/O in `loadFont.js`,
 * kept separate so the URL-picking logic is unit-testable without a network.
 *
 * Custom (Google Font by family name) resolution needs the Google Fonts CSS
 * API to turn an arbitrary family name into a woff2 URL (SPEC.md: "the Fonts
 * API is the only reliable resolver for arbitrary family names"). Because
 * that step itself requires a network round trip, `custom` returns a
 * `cssApiUrl` for the loader to fetch and parse, plus a `fallbackTtfUrl`
 * (jsDelivr Fontsource, guessed from a slugified family name) the loader
 * tries if the CSS API is unreachable.
 *
 * @param {{ family?: string, source?: "builtin"|"curated"|"custom" }} font
 * @returns
 *   | { kind: "builtin" }
 *   | { kind: "curated", family: string, ttfUrl: string }
 *   | { kind: "custom", family: string, cssApiUrl: string, fallbackTtfUrl: string }
 */
export function resolveFontSource(font) {
  const family = font?.family ?? COMIC_NEUE_FAMILY;

  if (!family || family === COMIC_NEUE_FAMILY) {
    return { kind: "builtin" };
  }

  const curated = findCuratedFontByFamily(family);
  // An explicit `source: "custom"` always takes the custom (Google Fonts API)
  // path, even if the typed family happens to match a curated name — the
  // maker chose the free-text picker on purpose. Otherwise a known curated
  // family (or an explicit `source: "curated"`) takes the curated path.
  if (font?.source !== "custom" && (font?.source === "curated" || curated)) {
    if (!curated) {
      throw new Error(`resolveFontSource: "${family}" is not in the curated set`);
    }
    return { kind: "curated", family: curated.family, ttfUrl: fontsourceTtfUrl(curated.fontsourceId) };
  }

  return {
    kind: "custom",
    family,
    cssApiUrl: googleFontsCssUrl(family),
    fallbackTtfUrl: fontsourceTtfUrl(slugifyFamily(family)),
  };
}

/** @returns {string} the Google Fonts CSS2 API URL that resolves any family name. */
export function googleFontsCssUrl(family) {
  const encoded = encodeURIComponent(family).replace(/%20/g, "+");
  return `https://fonts.googleapis.com/css2?family=${encoded}:wght@400&display=swap`;
}

/** @returns {string} a best-guess Fontsource slug for a family name (kebab-case). */
export function slugifyFamily(family) {
  return family
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
