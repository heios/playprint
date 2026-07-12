import LZString from "lz-string";
import { defaultState } from "../engine/defaultState.js";

/**
 * Secondary seam (SPEC.md "Secondary seam — state serialization"): pure
 * `encode`/`decode` over `ProjectState`, shared by localStorage projects
 * (issue #9) and URL-share (`shareUrl.js`). Kept dependency-free of the DOM —
 * no `localStorage`/`location` here — so it is unit-testable exactly like the
 * layout engine: feed it a state, assert on the output.
 *
 * Format: `ProjectState` -> JSON -> LZ-compressed, URL-safe string (via
 * `lz-string`'s `compressToEncodedURIComponent`, whose alphabet is already
 * `[A-Za-z0-9+-$]`-safe for both a URL hash fragment and a localStorage
 * value) so the exact same payload string works in both places (SPEC.md:
 * "compact JSON + LZ-compression to keep links short ... the hash keeps
 * state off the server").
 *
 * A non-default font travels as its `family`/`source` only (never font
 * bytes) — that's just `state.card.font` as-is, so no special-casing is
 * needed here; the opener's font pipeline (issue #7) re-fetches it.
 */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * @param {object} state - a `ProjectState` (SPEC.md "State object").
 * @returns {string} a compact, URL-safe, LZ-compressed payload string.
 */
export function encodeState(state) {
  const withVersion = { ...state, schemaVersion: CURRENT_SCHEMA_VERSION };
  const json = JSON.stringify(withVersion);
  return LZString.compressToEncodedURIComponent(json);
}

/**
 * @param {string} payload - a string previously produced by `encodeState`.
 * @returns {object} the decoded `ProjectState`, migrated to
 *   `CURRENT_SCHEMA_VERSION` and backfilled with any fields the payload was
 *   missing (older payload, or one hand-written by a test).
 * @throws {Error} if the payload is empty, corrupted/undecodable, not valid
 *   JSON, or declares a `schemaVersion` newer than this build understands.
 */
export function decodeState(payload) {
  if (!payload || typeof payload !== "string") {
    throw new Error("decodeState: payload is empty");
  }

  const json = LZString.decompressFromEncodedURIComponent(payload);
  if (!json) {
    throw new Error("decodeState: payload could not be decompressed (corrupted or invalid)");
  }

  let raw;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("decodeState: payload did not decode to valid JSON");
  }

  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("decodeState: payload did not decode to a ProjectState object");
  }

  return migrateState(raw);
}

/**
 * Applies schema migrations and backfills any field missing from `raw`
 * (e.g. an older payload encoded before a later ticket added a field) from
 * `defaultState()`, then stamps the current schema version. Deep-merges only
 * one level of nesting per known top-level key — enough for `ProjectState`'s
 * shallow-nested shape (SPEC.md "State object") without needing a generic
 * deep-merge here (that's `testState.js`'s job for test fixtures).
 */
function migrateState(raw) {
  const version = typeof raw.schemaVersion === "number" ? raw.schemaVersion : 0;
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `decodeState: payload schemaVersion ${version} is newer than this build supports (${CURRENT_SCHEMA_VERSION})`,
    );
  }

  const fallback = defaultState();
  const merged = deepMerge(fallback, raw);
  merged.schemaVersion = CURRENT_SCHEMA_VERSION;
  return merged;
}

function deepMerge(base, over) {
  if (Array.isArray(over) || over === null || typeof over !== "object") {
    return over === undefined ? base : over;
  }
  const out = { ...base };
  for (const key of Object.keys(over)) {
    const b = base?.[key];
    const o = over[key];
    out[key] = o && typeof o === "object" && !Array.isArray(o) && b && typeof b === "object" ? deepMerge(b, o) : o;
  }
  return out;
}
