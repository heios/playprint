import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Issue #2: Months / Digits presets fill the text box in one click, and stay
 * freely editable afterwards. Presets self-register as their own control
 * group (a new file + one barrel import), never by editing a shared list.
 */
describe("preset control group", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function loadGroups() {
    const { getRegisteredControlGroups } = await import("../registry.js");
    await import("../groups/index.js");
    return getRegisteredControlGroups();
  }

  it("registers a presets group with Months and Digits actions", async () => {
    const groups = await loadGroups();
    const presets = groups.find((g) => g.id === "presets");
    expect(presets).toBeTruthy();
    expect(presets.controls.map((c) => c.id).sort()).toEqual(["digits", "months"]);
  });

  it("Months preset fills January … December", async () => {
    const groups = await loadGroups();
    const months = groups.find((g) => g.id === "presets").controls.find((c) => c.id === "months");
    const next = months.setValue({ text: "old" });
    expect(next.text).toBe(
      "January February March April May June July August September October November December",
    );
  });

  it("Digits preset fills 0 1 1 2 2 3 4 5 6 7 8 9 (duplicates dates need)", async () => {
    const groups = await loadGroups();
    const digits = groups.find((g) => g.id === "presets").controls.find((c) => c.id === "digits");
    const next = digits.setValue({ text: "old" });
    expect(next.text).toBe("0 1 1 2 2 3 4 5 6 7 8 9");
  });

  it("presets only replace text, leaving text freely editable afterwards", async () => {
    const groups = await loadGroups();
    const digits = groups.find((g) => g.id === "presets").controls.find((c) => c.id === "digits");
    const state = { schemaVersion: 1, seed: 7, text: "whatever", card: { paddingMm: 4 } };
    const next = digits.setValue(state);
    // text replaced, everything else untouched, no mutation of the original.
    expect(next.text).toBe("0 1 1 2 2 3 4 5 6 7 8 9");
    expect(next.seed).toBe(7);
    expect(next.card).toEqual({ paddingMm: 4 });
    expect(state.text).toBe("whatever");
  });
});
