import { registerControlGroup } from "../registry.js";
import { hash32 } from "../../engine/seededTransform.js";

/**
 * Per-card playfulness + the seed controls (SPEC.md user stories 34, 36): the
 * card tilt/shift amounts, a numeric seed, and the Randomize button. The seed
 * and Randomize are the ONLY controls that "jump" — every amount slider morphs
 * continuously. Randomize derives a FRESH seed by hashing the current one, so
 * it is deterministic (testable) yet reshuffles on every click.
 *
 * Self-registered group (new file + one barrel import).
 */
registerControlGroup({
  id: "playful",
  label: "Card scatter & seed",
  controls: [
    {
      id: "card-tilt",
      label: "Card tilt (°)",
      type: "slider",
      max: 30,
      getValue: (state) => state.card?.rotationDeg ?? 0,
      setValue: (state, value) => setCard(state, { rotationDeg: num(value) }),
    },
    {
      id: "card-shift",
      label: "Card shift (mm)",
      type: "slider",
      max: 20,
      getValue: (state) => state.card?.offsetMm ?? 0,
      setValue: (state, value) => setCard(state, { offsetMm: num(value) }),
    },
    {
      id: "seed",
      label: "Seed",
      type: "number",
      getValue: (state) => state.seed ?? 0,
      setValue: (state, value) => ({ ...state, seed: Math.trunc(num(value)) }),
    },
    {
      id: "randomize",
      label: "Randomize",
      type: "button",
      getValue: () => "Randomize",
      // A fresh seed from the current one: hashing gives a well-mixed, distinct
      // integer each click, so the arrangement reshuffles deterministically.
      setValue: (state) => ({ ...state, seed: hash32(state.seed ?? 0, 0x9e3779b9) }),
    },
  ],
});

function setCard(state, patch) {
  return { ...state, card: { ...state.card, ...patch } };
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
