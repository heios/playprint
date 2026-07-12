import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Issue #3 control groups: playful-letter style + amounts (with progressive
 * disclosure) and the per-card scatter + seed/Randomize. Both self-register via
 * the barrel (new file + one import), never by editing a shared list. Controls
 * are pure getValue/setValue pairs over the shared ProjectState.
 */
describe("playful control groups", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function loadGroups() {
    const { getRegisteredControlGroups } = await import("../registry.js");
    await import("../groups/index.js");
    return getRegisteredControlGroups();
  }

  it("registers the letters and playful groups via the barrel", async () => {
    const ids = (await loadGroups()).map((g) => g.id);
    expect(ids).toContain("letters");
    expect(ids).toContain("playful");
  });

  it("letter style select drives the four styles", async () => {
    const style = (await loadGroups()).find((g) => g.id === "letters").controls.find((c) => c.id === "letter-style");
    expect(style.options).toEqual(["random", "wave", "alternating", "smile"]);
    expect(style.setValue({ letters: { style: "random" } }, "wave").letters.style).toBe("wave");
  });

  it("progressive disclosure: horizontal jitter only for random, wave frequency only for wave", async () => {
    const letters = (await loadGroups()).find((g) => g.id === "letters");
    const jitter = letters.controls.find((c) => c.id === "letter-horizontal");
    const freq = letters.controls.find((c) => c.id === "wave-frequency");

    expect(jitter.isVisible({ letters: { style: "random" } })).toBe(true);
    expect(jitter.isVisible({ letters: { style: "wave" } })).toBe(false);
    expect(freq.isVisible({ letters: { style: "wave" } })).toBe(true);
    expect(freq.isVisible({ letters: { style: "random" } })).toBe(false);
  });

  it("amount sliders write their slice of state.letters purely", async () => {
    const letters = (await loadGroups()).find((g) => g.id === "letters");
    const rot = letters.controls.find((c) => c.id === "letter-rotation");
    const state = { letters: { style: "random", rotationDeg: 0, verticalMm: 2 } };
    const next = rot.setValue(state, "18");
    expect(next.letters.rotationDeg).toBe(18);
    expect(next.letters.verticalMm).toBe(2); // untouched
    expect(state.letters.rotationDeg).toBe(0); // no mutation
  });

  it("Randomize produces a fresh, distinct seed each click and only touches seed", async () => {
    const randomize = (await loadGroups()).find((g) => g.id === "playful").controls.find((c) => c.id === "randomize");
    const state = { seed: 5, card: { rotationDeg: 3 }, text: "x" };
    const once = randomize.setValue(state);
    const twice = randomize.setValue(once);
    expect(once.seed).not.toBe(state.seed);
    expect(twice.seed).not.toBe(once.seed);
    // Only the seed jumps; everything else is carried through untouched.
    expect(once.card).toBe(state.card);
    expect(once.text).toBe("x");
    expect(state.seed).toBe(5); // no mutation
  });

  it("the numeric seed control sets an integer seed", async () => {
    const seed = (await loadGroups()).find((g) => g.id === "playful").controls.find((c) => c.id === "seed");
    expect(seed.setValue({ seed: 1 }, "42").seed).toBe(42);
  });

  it("card tilt/shift sliders write state.card purely", async () => {
    const playful = (await loadGroups()).find((g) => g.id === "playful");
    const tilt = playful.controls.find((c) => c.id === "card-tilt");
    const shift = playful.controls.find((c) => c.id === "card-shift");
    expect(tilt.setValue({ card: {} }, "9").card.rotationDeg).toBe(9);
    expect(shift.setValue({ card: {} }, "6").card.offsetMm).toBe(6);
  });
});
