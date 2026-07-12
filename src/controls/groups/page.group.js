import { registerControlGroup } from "../registry.js";
import { PAPER_SIZES } from "../../engine/paperSizes.js";

/**
 * Paper controls (SPEC.md user stories 42–45): the paper size picker
 * (A0–A10, B0–B10, US Letter/Legal/Tabloid), the portrait/landscape
 * orientation toggle, and the page margin in mm (default 15). Reads/writes
 * `state.page` purely; the size list is sourced from `paperSizes.js` (the
 * engine's own catalogue) so the picker can never drift from what
 * `pageDimensionsMm` actually resolves.
 *
 * Self-registered group (new file + one barrel import) — never by editing a
 * shared list.
 */
registerControlGroup({
  id: "page",
  label: "Paper",
  controls: [
    {
      id: "page-size",
      label: "Paper size",
      type: "select",
      options: Object.keys(PAPER_SIZES),
      getValue: (state) => state.page?.size ?? "A4",
      setValue: (state, value) => ({ ...state, page: { ...state.page, size: value } }),
    },
    {
      id: "page-orientation",
      label: "Orientation",
      type: "select",
      options: ["portrait", "landscape"],
      getValue: (state) => state.page?.orientation ?? "portrait",
      setValue: (state, value) => ({ ...state, page: { ...state.page, orientation: value } }),
    },
    {
      id: "page-margin",
      label: "Margin (mm)",
      type: "slider",
      max: 50,
      getValue: (state) => state.page?.marginMm ?? 15,
      setValue: (state, value) => ({ ...state, page: { ...state.page, marginMm: num(value) } }),
    },
  ],
});

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
