import { CURATED_FONT_THUMBNAILS_BASE64 } from "./generated/curatedThumbnailsBase64.js";

/**
 * The curated font set (SPEC.md Fonts: "Schoolbell, Twinkle Star, Yuyu,
 * Playpen Sans, Coming Soon, Patrick Hand, Short Stack"), each backed by a
 * Fontsource TTF served over jsDelivr's CDN (CORS-safe, no API key, stable
 * per-family URL — the same fallback source the spec names for custom
 * fonts). Pure data: no fetch happens here, so the picker can render every
 * thumbnail instantly (story 47) before any network activity.
 *
 * `fontsourceId` is the slug Fontsource publishes the family under; see
 * https://cdn.jsdelivr.net/fontsource/fonts/<fontsourceId>@latest/latin-400-normal.ttf
 *
 * @typedef {Object} CuratedFont
 * @property {string} key - stable id, also the key into the thumbnails map
 * @property {string} family - the exact font-family name used in ProjectState
 * @property {string} fontsourceId
 * @property {string} thumbnailDataUri - `data:image/png;base64,...` PNG, pre-baked
 */

/** @type {CuratedFont[]} */
export const CURATED_FONTS = [
  { key: "Schoolbell", family: "Schoolbell", fontsourceId: "schoolbell" },
  { key: "TwinkleStar", family: "Twinkle Star", fontsourceId: "twinkle-star" },
  { key: "Yuyu", family: "Yuyu", fontsourceId: "yuyu" },
  { key: "PlaypenSans", family: "Playpen Sans", fontsourceId: "playpen-sans" },
  { key: "ComingSoon", family: "Coming Soon", fontsourceId: "coming-soon" },
  { key: "PatrickHand", family: "Patrick Hand", fontsourceId: "patrick-hand" },
  { key: "ShortStack", family: "Short Stack", fontsourceId: "short-stack" },
].map((font) => ({
  ...font,
  thumbnailDataUri: `data:image/png;base64,${CURATED_FONT_THUMBNAILS_BASE64[font.key]}`,
}));

/** @returns {CuratedFont|undefined} the curated font entry for a family name. */
export function findCuratedFontByFamily(family) {
  return CURATED_FONTS.find((f) => f.family === family);
}

/** @returns {string} the jsDelivr Fontsource TTF URL for a curated font. */
export function fontsourceTtfUrl(fontsourceId) {
  return `https://cdn.jsdelivr.net/fontsource/fonts/${fontsourceId}@latest/latin-400-normal.ttf`;
}
