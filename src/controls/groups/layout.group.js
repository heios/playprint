import { registerControlGroup } from "../registry.js";

/**
 * Layout controls (SPEC.md user stories 10–15, 37–41): the layout MODE (Grid /
 * Flexible / Random), the card SIZING (uniform / fit), the gap between
 * neighbouring cards and the row alignment. Each reads/writes its slice of
 * `state.layout` purely.
 *
 * Self-registered group (new file + one barrel import). The Random-only scatter
 * sliders live in their own `scatter.group.js` so this group has no mode-gated
 * controls of its own.
 */
registerControlGroup({
  id: "layout",
  label: "Layout",
  controls: [
    {
      id: "layout-mode",
      label: "Layout mode",
      type: "select",
      options: ["grid", "flexible", "random"],
      getValue: (state) => state.layout?.mode ?? "grid",
      setValue: (state, value) => ({ ...state, layout: { ...state.layout, mode: value } }),
    },
    {
      id: "card-sizing",
      label: "Card sizing",
      type: "select",
      options: ["uniform", "fit"],
      getValue: (state) => state.layout?.cardSizing ?? "uniform",
      setValue: (state, value) => ({ ...state, layout: { ...state.layout, cardSizing: value } }),
    },
    {
      id: "gap",
      label: "Gap (mm)",
      type: "slider",
      getValue: (state) => state.layout?.gapMm ?? 4,
      setValue: (state, value) => ({ ...state, layout: { ...state.layout, gapMm: num(value) } }),
    },
    {
      id: "row-align",
      label: "Row alignment",
      type: "select",
      options: ["left", "center", "right"],
      getValue: (state) => state.layout?.rowAlign ?? "center",
      setValue: (state, value) => ({ ...state, layout: { ...state.layout, rowAlign: value } }),
    },
  ],
});

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
