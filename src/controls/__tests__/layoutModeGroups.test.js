import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Issue #5 controls: the layout-mode + card-sizing selectors (on the existing
 * "layout" group) and the Random-only scatter sliders (a new self-registered
 * group). Progressive disclosure: scatter controls appear only in Random mode.
 */
describe("layout-mode & scatter controls", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function groups() {
    const { getRegisteredControlGroups } = await import("../registry.js");
    await import("../groups/index.js");
    return getRegisteredControlGroups();
  }

  it("exposes a layout mode selector with grid/flexible/random", async () => {
    const layout = (await groups()).find((g) => g.id === "layout");
    const mode = layout.controls.find((c) => c.id === "layout-mode");
    expect(mode).toBeTruthy();
    expect(mode.options).toEqual(["grid", "flexible", "random"]);

    const state = { layout: { mode: "grid" } };
    expect(mode.getValue(state)).toBe("grid");
    expect(mode.setValue(state, "flexible").layout.mode).toBe("flexible");
  });

  it("exposes a card-sizing selector with uniform/fit", async () => {
    const layout = (await groups()).find((g) => g.id === "layout");
    const sizing = layout.controls.find((c) => c.id === "card-sizing");
    expect(sizing.options).toEqual(["uniform", "fit"]);
    const state = { layout: { cardSizing: "uniform" } };
    expect(sizing.setValue(state, "fit").layout.cardSizing).toBe("fit");
  });

  it("registers a scatter group visible only in Random mode", async () => {
    const scatter = (await groups()).find((g) => g.id === "scatter");
    expect(scatter).toBeTruthy();
    expect(scatter.isVisible({ layout: { mode: "random" } })).toBe(true);
    expect(scatter.isVisible({ layout: { mode: "grid" } })).toBe(false);
  });

  it("scatter sliders read/write state.layout.random purely", async () => {
    const scatter = (await groups()).find((g) => g.id === "scatter");
    const rot = scatter.controls.find((c) => c.id === "scatter-rotation");
    const shift = scatter.controls.find((c) => c.id === "scatter-shift");
    const state = { layout: { random: { rotationDeg: 0, shiftMm: 0 } } };
    expect(rot.setValue(state, 20).layout.random.rotationDeg).toBe(20);
    expect(shift.setValue(state, 12).layout.random.shiftMm).toBe(12);
  });
});
