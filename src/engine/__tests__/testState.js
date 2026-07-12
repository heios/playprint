import { defaultState } from "../defaultState.js";

/**
 * Build a ProjectState for tests by deep-merging overrides onto the engine's
 * real `defaultState()`. Keeps tests focused on the fields under test while
 * exercising the same defaults the app ships with.
 */
export function makeState(overrides = {}) {
  return deepMerge(defaultState(), overrides);
}

function deepMerge(base, over) {
  if (Array.isArray(over) || over === null || typeof over !== "object") return over;
  const out = { ...base };
  for (const key of Object.keys(over)) {
    const b = base?.[key];
    const o = over[key];
    out[key] = o && typeof o === "object" && !Array.isArray(o) && b && typeof b === "object" ? deepMerge(b, o) : o;
  }
  return out;
}
