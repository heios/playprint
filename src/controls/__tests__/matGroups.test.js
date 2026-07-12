import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Issue #4 control groups: the outer mat (whose controls appear ONLY when
 * enabled — SPEC.md story 21) and the per-pass layer-visibility toggles
 * (stories 27–28). Both self-register via the barrel (new file + one import),
 * never by editing a shared list. Controls are pure getValue/setValue pairs
 * over the shared ProjectState.
 */
describe("mat + visibility control groups", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function loadGroups() {
    const { getRegisteredControlGroups } = await import("../registry.js");
    await import("../groups/index.js");
    return getRegisteredControlGroups();
  }

  it("registers the mat-toggle, mat and visibility groups via the barrel", async () => {
    const ids = (await loadGroups()).map((g) => g.id);
    expect(ids).toContain("mat-toggle");
    expect(ids).toContain("mat");
    expect(ids).toContain("visibility");
  });

  it("the mat styling group is hidden until the outer border is enabled (story 21)", async () => {
    const mat = (await loadGroups()).find((g) => g.id === "mat");
    expect(mat.isVisible({ card: { outer: { enabled: false } } })).toBe(false);
    expect(mat.isVisible({ card: {} })).toBe(false);
    expect(mat.isVisible({ card: { outer: { enabled: true } } })).toBe(true);
  });

  it("the always-shown enable toggle turns the mat on and off purely", async () => {
    const enable = (await loadGroups()).find((g) => g.id === "mat-toggle").controls.find((c) => c.id === "mat-enabled");
    expect(enable.getValue({ card: { outer: { enabled: false } } })).toBe(false);
    const on = enable.setValue({ card: { outer: { enabled: false } } }, true);
    expect(on.card.outer.enabled).toBe(true);
  });

  it("mat colour / stroke / radius / amount / clearance / balance write state.card.outer purely", async () => {
    const mat = (await loadGroups()).find((g) => g.id === "mat");
    const state = { card: { outer: { enabled: true, matPercent: 20, minClearanceMm: 2, balanceRatio: 2 } } };

    const set = (id, v) => mat.controls.find((c) => c.id === id).setValue(state, v);
    expect(set("mat-color", "#123456").card.outer.color).toBe("#123456");
    expect(set("mat-stroke", "1.5").card.outer.strokeMm).toBe(1.5);
    expect(set("mat-radius", "3").card.outer.radiusMm).toBe(3);
    expect(set("mat-amount", "40").card.outer.matPercent).toBe(40);
    expect(set("mat-clearance", "5").card.outer.minClearanceMm).toBe(5);
    expect(set("mat-balance", "2.5").card.outer.balanceRatio).toBe(2.5);
    // No mutation of the input state.
    expect(state.card.outer.matPercent).toBe(20);
  });

  it("visibility toggles drive state.visibility.{outer,inner,text} purely", async () => {
    const vis = (await loadGroups()).find((g) => g.id === "visibility");
    const outer = vis.controls.find((c) => c.id === "vis-outer");
    const inner = vis.controls.find((c) => c.id === "vis-inner");
    const text = vis.controls.find((c) => c.id === "vis-text");

    const state = { visibility: { outer: true, inner: true, text: true } };
    expect(outer.getValue(state)).toBe(true);
    expect(outer.setValue(state, false).visibility.outer).toBe(false);
    expect(inner.setValue(state, false).visibility.inner).toBe(false);
    expect(text.setValue(state, false).visibility.text).toBe(false);
    // Independent switches — toggling one leaves the others untouched.
    expect(outer.setValue(state, false).visibility.inner).toBe(true);
    expect(state.visibility.outer).toBe(true); // no mutation
  });
});
