import { registerControlGroup } from "../registry.js";

/**
 * Outer-mat controls (SPEC.md user stories 20–26): the optional second border
 * behind each card. The whole group is disclosed ONLY when the mat is enabled
 * (story 21) via the group-level `isVisible`, so the panel stays uncluttered.
 * The mat has its OWN colour, stroke and radius (story 22), a mat AMOUNT for
 * the relative inner→outer size (story 23), a minimum-clearance floor (story
 * 25), and a balance ratio k (story 26). Each reads/writes its slice of
 * `state.card.outer` purely (returns a new state, never mutates).
 *
 * The enable toggle itself lives in the group but is always meaningful; the
 * group's own controls (below it) hide until enabled. Self-registered group
 * (new file + one barrel import) — never by editing a shared list.
 */
registerControlGroup({
  id: "mat",
  label: "Outer mat",
  // Progressive disclosure: the mat's styling controls only matter once it is on.
  isVisible: (state) => state.card?.outer?.enabled === true,
  controls: [
    {
      id: "mat-color",
      label: "Mat colour",
      type: "color",
      getValue: (state) => state.card?.outer?.color ?? "#ff5aa5",
      setValue: (state, value) => setOuter(state, { color: value }),
    },
    {
      id: "mat-stroke",
      label: "Mat stroke (mm)",
      type: "slider",
      getValue: (state) => state.card?.outer?.strokeMm ?? 0.5,
      setValue: (state, value) => setOuter(state, { strokeMm: num(value) }),
    },
    {
      id: "mat-radius",
      label: "Mat corner radius (mm)",
      type: "slider",
      getValue: (state) => state.card?.outer?.radiusMm ?? 0,
      setValue: (state, value) => setOuter(state, { radiusMm: num(value) }),
    },
    {
      id: "mat-amount",
      label: "Mat amount (%)",
      type: "slider",
      min: 0,
      max: 60,
      getValue: (state) => state.card?.outer?.matPercent ?? 25,
      setValue: (state, value) => setOuter(state, { matPercent: num(value) }),
    },
    {
      id: "mat-clearance",
      label: "Min clearance (mm)",
      type: "slider",
      min: 0,
      max: 15,
      getValue: (state) => state.card?.outer?.minClearanceMm ?? 2,
      setValue: (state, value) => setOuter(state, { minClearanceMm: num(value) }),
    },
    {
      id: "mat-balance",
      label: "Balance (k)",
      type: "slider",
      min: 1,
      max: 5,
      step: 0.1,
      getValue: (state) => state.card?.outer?.balanceRatio ?? 2,
      setValue: (state, value) => setOuter(state, { balanceRatio: num(value) }),
    },
  ],
});

/**
 * The mat enable/disable toggle. Kept in its own group so it is ALWAYS shown
 * (the "Outer mat" styling group above hides until this is on — story 21).
 */
registerControlGroup({
  id: "mat-toggle",
  label: "Second border (mat)",
  controls: [
    {
      id: "mat-enabled",
      label: "Add a mat behind each card",
      type: "toggle",
      getValue: (state) => state.card?.outer?.enabled === true,
      setValue: (state, value) => setOuter(state, { enabled: value === true }),
    },
  ],
});

function setOuter(state, patch) {
  return { ...state, card: { ...state.card, outer: { ...state.card?.outer, ...patch } } };
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
