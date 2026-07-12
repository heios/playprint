import { registerControlGroup } from "../registry.js";

/**
 * Layout controls for the Grid/uniform slice (SPEC.md user stories 15, 41):
 * the gap between neighbouring cards and the row alignment. Each reads/writes
 * its slice of `state.layout` purely.
 *
 * Self-registered group (new file + one barrel import). Later slices add
 * layout-mode and card-sizing controls the same way.
 */
registerControlGroup({
  id: "layout",
  label: "Layout",
  controls: [
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
