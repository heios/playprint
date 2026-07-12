import { encodeState, decodeState } from "./serializeState.js";

/**
 * Share-by-URL (SPEC.md stories 61-62): encodes the full `ProjectState` into
 * the URL **hash fragment** — never a query param or the server — so state
 * never leaves the browser (SPEC.md: "the hash keeps state off the server").
 * Thin wrapper: all the actual encoding/decoding is `serializeState.js`;
 * this module only shapes the payload into/out of a URL string.
 *
 * Takes the base URL as a plain string (not `window.location`) so it stays
 * unit-testable without a DOM — the page wires it to `location.href`/
 * `location.hash` at call sites (`main.js`), same injection spirit as `env`.
 */

/**
 * @param {string} baseUrl - the page URL, with or without an existing hash
 *   (e.g. `location.href`). Any existing hash is replaced.
 * @param {object} state - the `ProjectState` to encode.
 * @returns {string} `baseUrl`'s origin+path+search with a fresh `#<payload>`.
 */
export function buildShareUrl(baseUrl, state) {
  const withoutHash = baseUrl.split("#")[0];
  const payload = encodeState(state);
  return `${withoutHash}#${payload}`;
}

/**
 * @param {string|undefined} hash - a hash fragment, with or without a
 *   leading `#` (e.g. `location.hash`).
 * @returns {object|null} the decoded `ProjectState`, or `null` if `hash` is
 *   empty/missing or fails to decode (corrupted/foreign link) — callers
 *   treat `null` as "no shared state, fall back to defaults" rather than a
 *   fatal error.
 */
export function readStateFromHash(hash) {
  if (!hash) return null;
  const payload = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!payload) return null;

  try {
    return decodeState(payload);
  } catch {
    return null;
  }
}
