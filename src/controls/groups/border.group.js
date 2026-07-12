import { registerControlGroup } from "../registry.js";

/**
 * Inner-border controls (SPEC.md user stories 13, 16–19): the rectangular cut
 * line around each word. Padding spaces word→border; colour, stroke width (mm)
 * and corner radius style the line; a toggle turns it off for a borderless
 * poster. Each reads/writes its slice of `state.card` purely (returns a new
 * state, never mutates).
 *
 * Self-registered group (new file + one barrel import) — the outer-mat group
 * will copy this shape in a later slice without editing any shared list.
 */
registerControlGroup({
  id: "border",
  label: "Card border",
  controls: [
    {
      id: "border-visible",
      label: "Show border",
      type: "toggle",
      getValue: (state) => state.card?.inner?.visible !== false,
      setValue: (state, value) => setInner(state, { visible: value }),
    },
    {
      id: "padding",
      label: "Padding (mm)",
      type: "slider",
      getValue: (state) => state.card?.paddingMm ?? 4,
      setValue: (state, value) => ({ ...state, card: { ...state.card, paddingMm: num(value) } }),
    },
    {
      id: "border-color",
      label: "Border colour",
      type: "color",
      getValue: (state) => state.card?.inner?.color ?? "#000000",
      setValue: (state, value) => setInner(state, { color: value }),
    },
    {
      id: "border-stroke",
      label: "Stroke width (mm)",
      type: "slider",
      getValue: (state) => state.card?.inner?.strokeMm ?? 0.5,
      setValue: (state, value) => setInner(state, { strokeMm: num(value) }),
    },
    {
      id: "border-radius",
      label: "Corner radius (mm)",
      type: "slider",
      getValue: (state) => state.card?.inner?.radiusMm ?? 0,
      setValue: (state, value) => setInner(state, { radiusMm: num(value) }),
    },
  ],
});

function setInner(state, patch) {
  return { ...state, card: { ...state.card, inner: { ...state.card?.inner, ...patch } } };
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
