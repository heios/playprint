import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Proves the end-to-end registration pattern: importing the groups barrel
 * causes the example "text" group to register itself, with no shared list
 * of groups anywhere. `vi.resetModules` forces a fresh registry module
 * per test since registration runs at import time.
 */
describe("control groups barrel", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("registers the example text group as a side effect of importing the barrel", async () => {
    const { getRegisteredControlGroups } = await import("../registry.js");
    await import("../groups/index.js");

    const groups = getRegisteredControlGroups();

    expect(groups.map((g) => g.id)).toContain("text");
  });

  it("the registered text group exposes a working getValue/setValue pair", async () => {
    const { getRegisteredControlGroups } = await import("../registry.js");
    await import("../groups/index.js");

    const textGroup = getRegisteredControlGroups().find((g) => g.id === "text");
    const control = textGroup.controls.find((c) => c.id === "text");

    const state = { text: "January" };
    expect(control.getValue(state)).toBe("January");
    expect(control.setValue(state, "February").text).toBe("February");
  });
});
