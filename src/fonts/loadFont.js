import { COMIC_NEUE_FAMILY, comicNeueDataUri, comicNeueTtfBytes } from "./comicNeue.js";
import { resolveFontSource, googleFontsCssUrl } from "./resolveFontSource.js";
import { fetchArrayBufferWithProgress } from "./fetchWithProgress.js";
import { decodeWoff2ToTtf } from "./decodeWoff2ToTtf.js";

/**
 * The font pipeline's single orchestrator (SPEC.md Fonts, issue #7): resolves
 * a `card.font` spec to bytes, fetching + (lazily) decoding as needed, then
 * registers a `FontFace` so BOTH previews immediately reflect the chosen font
 * (SPEC.md: "The selected font is reflected in both previews"). This is the
 * thin adapter the spec calls for — all network/DOM/wasm calls live here or
 * in the small modules it composes; the pure engine never imports this file.
 *
 * Kept out of `computeLayout`'s pipeline entirely: the engine only ever reads
 * `state.card.font.family` as a *string* for `env.measureText` (already
 * wired — see `passes/size.js` and `passes/letterTransforms.js`). Once this
 * module registers the `FontFace`, the browser's `measureText`/rendering
 * naturally picks it up with no engine change needed.
 *
 * @param {{ family?: string, source?: "builtin"|"curated"|"custom" }} font
 * @param {{
 *   onProgress?: (p: { loadedBytes: number, totalBytes: number|null }) => void,
 *   fetchImpl?: typeof fetch,
 *   fontFaceSet?: FontFaceSet,   // defaults to document.fonts
 *   FontFaceCtor?: typeof FontFace,
 * }} [opts]
 * @returns {Promise<{ family: string, ttfBytes: Uint8Array, source: "builtin"|"curated"|"custom" }>}
 */
export async function loadFont(font, opts = {}) {
  const { onProgress = () => {}, fetchImpl, fontFaceSet, FontFaceCtor } = opts;
  const resolved = resolveFontSource(font);

  if (resolved.kind === "builtin") {
    onProgress({ loadedBytes: 1, totalBytes: 1 });
    const ttfBytes = comicNeueTtfBytes();
    await registerFontFace(COMIC_NEUE_FAMILY, comicNeueDataUri(), { fontFaceSet, FontFaceCtor });
    return { family: COMIC_NEUE_FAMILY, ttfBytes, source: "builtin" };
  }

  if (resolved.kind === "curated") {
    // Fontsource's direct TTF is the fast, no-decode path (SPEC.md: "the TTF
    // is fetched on selection"); a handful of curated families aren't
    // published there (e.g. Yuyu), so fall back to the same Google-Fonts
    // CSS-API -> woff2 -> decode route the custom-font path uses — the
    // curated set is still guaranteed to load, just via the slower path.
    const ttfBytes = await resolveTtfWithFallback(resolved.family, resolved.ttfUrl, onProgress, fetchImpl);
    await registerFontFaceBytes(resolved.family, ttfBytes, { fontFaceSet, FontFaceCtor });
    return { family: resolved.family, ttfBytes, source: "curated" };
  }

  // custom: resolve the family via the Google Fonts CSS API to a woff2 URL,
  // then lazily decode woff2 -> TTF (SPEC.md: "loaded only when a
  // non-default/custom font is first used"); fall back to the Fontsource TTF
  // guess if the CSS API call fails.
  const ttfBytes = await resolveTtfWithFallback(resolved.family, resolved.fallbackTtfUrl, onProgress, fetchImpl, {
    preferGoogleFonts: true,
  });
  await registerFontFaceBytes(resolved.family, ttfBytes, { fontFaceSet, FontFaceCtor });
  return { family: resolved.family, ttfBytes, source: "custom" };
}

/**
 * Fetches a family's TTF bytes, trying the fast direct-TTF URL first (curated:
 * Fontsource; custom: still Fontsource, as a *fallback* — see
 * `preferGoogleFonts`) and falling back to the Google Fonts CSS API -> woff2
 * -> lazy-decode route if that fails (SPEC.md: "jsDelivr / Fontsource is the
 * CORS-safe fallback source"). `preferGoogleFonts` flips the try order for
 * the custom-font path, where the CSS API is the primary resolver for
 * arbitrary family names (SPEC.md: "the Fonts API is the only reliable
 * resolver for arbitrary family names").
 */
async function resolveTtfWithFallback(family, directTtfUrl, onProgress, fetchImpl, { preferGoogleFonts = false } = {}) {
  const tryDirect = async () => {
    const buffer = await fetchArrayBufferWithProgress(directTtfUrl, onProgress, { fetch: fetchImpl });
    return new Uint8Array(buffer);
  };
  const tryGoogleFonts = async () => {
    const woff2Url = await resolveGoogleFontsWoff2Url(family, fetchImpl);
    const buffer = await fetchArrayBufferWithProgress(woff2Url, onProgress, { fetch: fetchImpl });
    return await decodeWoff2ToTtf(buffer);
  };

  const [primary, fallback] = preferGoogleFonts ? [tryGoogleFonts, tryDirect] : [tryDirect, tryGoogleFonts];
  try {
    return await primary();
  } catch {
    return await fallback();
  }
}

/**
 * Fetches the Google Fonts CSS2 API response for a family and extracts the
 * first (Latin, regular-weight) `woff2` source URL it lists.
 */
async function resolveGoogleFontsWoff2Url(family, fetchImpl) {
  const fetchFn = fetchImpl ?? globalThis.fetch;
  const response = await fetchFn(googleFontsCssUrl(family));
  if (!response.ok) throw new Error(`Google Fonts CSS API responded ${response.status} for "${family}"`);
  const css = await response.text();
  const match = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/);
  if (!match) throw new Error(`Google Fonts CSS API returned no woff2 source for "${family}"`);
  return match[1];
}

async function registerFontFaceBytes(family, ttfBytes, deps) {
  const dataUri = `data:font/ttf;base64,${bytesToBase64(ttfBytes)}`;
  await registerFontFace(family, dataUri, deps);
}

/**
 * Registers a `FontFace` with the document (or an injected `FontFaceSet`, for
 * tests) so the browser can immediately use the family for measurement and
 * rendering in both previews. A no-op (resolves immediately) when no
 * `FontFace`/`document.fonts` is available, e.g. under Node test runs that
 * don't need the DOM side effect — the returned bytes are still correct.
 */
async function registerFontFace(family, src, { fontFaceSet, FontFaceCtor } = {}) {
  const FF = FontFaceCtor ?? globalThis.FontFace;
  const set = fontFaceSet ?? globalThis.document?.fonts;
  if (typeof FF !== "function" || !set) return;

  const face = new FF(family, `url(${src})`);
  await face.load();
  set.add(face);
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
