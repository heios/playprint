import woff2WasmUrl from "./generated/woff2.wasm?url";

/**
 * Thin I/O adapter around `fonteditor-core`'s wasm woff2 codec (SPEC.md
 * Fonts: "the fetched woff2 is decoded to TTF via a LAZILY-LOADED decoder
 * (loaded only when a non-default/custom font is first used)"). The
 * `import("fonteditor-core")` below is a dynamic import so the ~large wasm
 * payload is never pulled into the initial bundle — Comic Neue (offline) and
 * curated fonts that are already-TTF (Fontsource) never touch this module.
 *
 * `woff2.init(wasmUrl)` needs an EXPLICIT wasm asset URL under a bundler: its
 * default `locateFile` resolves `woff2.wasm` relative to the page's own URL
 * (empty `scriptDirectory` once bundled), not next to the hashed chunk Vite
 * actually emits — that 404s (serving the SPA's `index.html` instead) and
 * crashes the wasm instantiate step. The `?url` import asks Vite to emit the
 * wasm as its own asset and hand back its real, hashed URL, which we thread
 * straight into `init()` — the exact hook `fonteditor-core` exposes for this
 * (see `node_modules/fonteditor-core/woff2/index.js`).
 *
 * `./generated/woff2.wasm` is a byte-for-byte copy of
 * `fonteditor-core/woff2/woff2.wasm`, checked in locally because the
 * package's `exports` map doesn't expose that subpath for bundlers to import
 * directly (only `.` and `./lib/*`). Regenerate it after bumping
 * `fonteditor-core` with:
 *   cp node_modules/fonteditor-core/woff2/woff2.wasm src/fonts/generated/woff2.wasm
 *
 * Only reached when a font source (custom, or a Fontsource fallback that
 * turns out to serve woff2) needs decoding; kept out of the pure engine
 * entirely (SPEC.md: "network kept out of the pure engine").
 */
let modulePromise;

/** Loads (once, cached) and initializes the wasm woff2 codec. */
async function loadWoff2Module() {
  if (!modulePromise) {
    modulePromise = import("fonteditor-core").then(async (mod) => {
      await mod.woff2.init(woff2WasmUrl);
      return mod;
    });
  }
  return modulePromise;
}

/**
 * @param {ArrayBuffer|Uint8Array} woff2Bytes
 * @returns {Promise<Uint8Array>} the equivalent TTF bytes
 */
export async function decodeWoff2ToTtf(woff2Bytes) {
  const { createFont } = await loadWoff2Module();
  const font = createFont(toUint8Array(woff2Bytes), { type: "woff2", hinting: true });
  const ttf = font.write({ type: "ttf" });
  return toUint8Array(ttf);
}

function toUint8Array(bytes) {
  return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
}

/** Test/advanced-use only: resets the cached module promise. */
export function _resetWoff2ModuleForTests() {
  modulePromise = undefined;
}
