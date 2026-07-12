import { registerControlGroup } from "../registry.js";

/**
 * Random-mode scatter controls (SPEC.md user stories 39–40): the per-card tilt
 * and shift amounts for the clamp-to-cell scatter. The whole group is gated by
 * progressive disclosure (story: "scatter sliders only in Random") so it shows
 * only when `layout.mode === "random"`. Each reads/writes its slice of
 * `state.layout.random` purely; the amounts only SCALE the seeded scatter, so
 * dragging them morphs the sheet continuously and only a new seed reshuffles.
 *
 * Self-registered group (new file + one barrel import) — never by editing a
 * shared list.
 */
registerControlGroup({
  id: "scatter",
  label: "Random scatter",
  isVisible: (state) => (state.layout?.mode ?? "grid") === "random",
  controls: [
    {
      id: "scatter-rotation",
      label: "Scatter tilt (°)",
      type: "slider",
      max: 45,
      getValue: (state) => state.layout?.random?.rotationDeg ?? 0,
      setValue: (state, value) => setRandom(state, { rotationDeg: num(value) }),
    },
    {
      id: "scatter-shift",
      label: "Scatter shift (mm)",
      type: "slider",
      max: 40,
      getValue: (state) => state.layout?.random?.shiftMm ?? 0,
      setValue: (state, value) => setRandom(state, { shiftMm: num(value) }),
    },
  ],
});

function setRandom(state, patch) {
  return { ...state, layout: { ...state.layout, random: { ...state.layout?.random, ...patch } } };
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
