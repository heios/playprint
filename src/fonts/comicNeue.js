import { COMIC_NEUE_REGULAR_TTF_BASE64 } from "./generated/comicNeueTtfBase64.js";

/**
 * The offline default font (SPEC.md story 48 / Fonts: "Comic Neue: embedded
 * in the page as base64 TTF -> offline default, no fetch/decode"). Pure data
 * + one pure helper — no DOM/network here, so it is trivially testable and
 * safe to import from anywhere (including the pure engine's tests) without
 * pulling in I/O.
 */
export const COMIC_NEUE_FAMILY = "Comic Neue";

/**
 * @returns {string} a `data:` URI for the embedded Comic Neue TTF, suitable
 *   for a `FontFace` source or an `@font-face` `src: url(...)`.
 */
export function comicNeueDataUri() {
  return `data:font/ttf;base64,${COMIC_NEUE_REGULAR_TTF_BASE64}`;
}

/**
 * @returns {Uint8Array} the raw TTF bytes, decoded from the embedded base64.
 *   Useful for PDF embedding (issue #8) without a second network round trip.
 */
export function comicNeueTtfBytes() {
  return base64ToBytes(COMIC_NEUE_REGULAR_TTF_BASE64);
}

/** Pure base64 -> Uint8Array, works in both browser and Node/test environments. */
export function base64ToBytes(base64) {
  if (typeof atob === "function") {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  // eslint-disable-next-line no-undef -- Node test environment fallback only.
  return new Uint8Array(Buffer.from(base64, "base64"));
}
