import { registerControlGroup } from "../registry.js";

/**
 * Layer-visibility toggles (SPEC.md user stories 27–28): show just the Outer
 * mat, the Inner card, and/or the Text for each print pass, so the maker can
 * print the inner card + word first, then hide them and print only the mats —
 * the two matted layers that line up. These are INDEPENDENT switches over
 * `state.visibility`; the engine reads them in the `mat` pass to gate each
 * layer's `visible` flag (outer/inner) and the glyphs (`textVisible`).
 *
 * Self-registered group (new file + one barrel import) — never by editing a
 * shared list.
 */
registerControlGroup({
  id: "visibility",
  label: "Layer visibility (print passes)",
  controls: [
    {
      id: "vis-outer",
      label: "Show outer (mat)",
      type: "toggle",
      getValue: (state) => state.visibility?.outer !== false,
      setValue: (state, value) => setVisibility(state, { outer: value }),
    },
    {
      id: "vis-inner",
      label: "Show inner (card)",
      type: "toggle",
      getValue: (state) => state.visibility?.inner !== false,
      setValue: (state, value) => setVisibility(state, { inner: value }),
    },
    {
      id: "vis-text",
      label: "Show text",
      type: "toggle",
      getValue: (state) => state.visibility?.text !== false,
      setValue: (state, value) => setVisibility(state, { text: value }),
    },
  ],
});

function setVisibility(state, patch) {
  return { ...state, visibility: { ...state.visibility, ...patch } };
}
