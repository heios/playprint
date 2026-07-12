import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Issue #6: the Paper group (SPEC.md user stories 42–45) — paper size picker
 * (A0–A10, B0–B10, US Letter/Legal/Tabloid), portrait/landscape toggle, and
 * page margin (default 15mm, in mm). Self-registered group (new file + one
 * barrel import), read/writes `state.page` purely.
 */
describe("page (paper) controls", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function groups() {
    const { getRegisteredControlGroups } = await import("../registry.js");
    await import("../groups/index.js");
    return getRegisteredControlGroups();
  }

  it("registers a page group with a size selector covering A0-A10, B0-B10, US sizes", async () => {
    const page = (await groups()).find((g) => g.id === "page");
    expect(page).toBeTruthy();

    const size = page.controls.find((c) => c.id === "page-size");
    expect(size).toBeTruthy();
    for (const s of ["A0", "A4", "A10", "B0", "B4", "B10", "Letter", "Legal", "Tabloid"]) {
      expect(size.options).toContain(s);
    }

    const state = { page: { size: "A4" } };
    expect(size.getValue(state)).toBe("A4");
    expect(size.setValue(state, "Letter").page.size).toBe("Letter");
  });

  it("exposes a portrait/landscape orientation toggle", async () => {
    const page = (await groups()).find((g) => g.id === "page");
    const orientation = page.controls.find((c) => c.id === "page-orientation");
    expect(orientation.options).toEqual(["portrait", "landscape"]);

    const state = { page: { orientation: "portrait" } };
    expect(orientation.getValue(state)).toBe("portrait");
    expect(orientation.setValue(state, "landscape").page.orientation).toBe("landscape");
  });

  it("exposes a margin control in mm defaulting to 15", async () => {
    const page = (await groups()).find((g) => g.id === "page");
    const margin = page.controls.find((c) => c.id === "page-margin");
    expect(margin).toBeTruthy();

    const state = { page: {} };
    expect(margin.getValue(state)).toBe(15);
    expect(margin.setValue(state, 20).page.marginMm).toBe(20);
  });
});
