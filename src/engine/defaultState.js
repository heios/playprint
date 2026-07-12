/**
 * The canonical ProjectState the app boots with and tests build on — the
 * single object that drives rendering (SPEC.md "State object"). Kept as a
 * factory (not a shared frozen constant) so every caller gets its own
 * mutable-free copy and no two consumers alias nested objects.
 *
 * Issue #2 populates only the fields the "Grid, uniform, inner-border" slice
 * needs; later slices (mat, playful letters, random/flexible modes, fonts,
 * projects) fill in their own branches without changing these defaults.
 */
export function defaultState() {
  return {
    schemaVersion: 1,
    name: "Untitled",
    text: "",
    seed: 1,
    page: { size: "A4", orientation: "portrait", marginMm: 15 },
    layout: {
      mode: "grid",
      cardSizing: "uniform",
      gapMm: 4,
      rowAlign: "center",
      grid: { columns: "auto" },
    },
    card: {
      font: { family: "Comic Neue", source: "builtin", sizePt: 24, letterSpacingMm: 0 },
      textColor: "#000000",
      paddingMm: 4,
      // Per-card playful drift (seeded, continuous — SPEC.md stories 34–36).
      offsetMm: 0,
      rotationDeg: 0,
      inner: { color: "#000000", strokeMm: 0.5, radiusMm: 0, visible: true },
    },
    // Playful letter styling (SPEC.md stories 29–36). All amounts default to 0
    // so the ticket-#2 baseline (flat, centred text) is unchanged until a maker
    // dials playfulness up; every amount only SCALES a fixed seeded direction.
    letters: {
      style: "random",
      rotationDeg: 0,
      verticalMm: 0,
      horizontalJitterMm: 0, // random style only
      waveFrequency: 1, // wave style only (cycles per word)
    },
  };
}
