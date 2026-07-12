import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Font control group (SPEC.md user stories 47-51 / issue #7): registers via
 * the barrel like every other group, exposes the curated set + Comic Neue as
 * `font-picker` options with pre-baked thumbnails, a free-text custom family
 * field, and size/letter-spacing sliders — all pure getValue/setValue pairs
 * over `state.card.font`.
 */
describe("font control group", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function loadGroups() {
    const { getRegisteredControlGroups } = await import("../registry.js");
    await import("../groups/index.js");
    return getRegisteredControlGroups();
  }

  it("registers the font group via the barrel", async () => {
    const ids = (await loadGroups()).map((g) => g.id);
    expect(ids).toContain("font");
  });

  it("the font-picker control lists Comic Neue first, then all 7 curated fonts with thumbnails", async () => {
    const font = (await loadGroups()).find((g) => g.id === "font");
    const picker = font.controls.find((c) => c.id === "font-picker");

    expect(picker.type).toBe("font-picker");
    expect(picker.options[0]).toMatchObject({ family: "Comic Neue", source: "builtin" });
    expect(picker.options).toHaveLength(8);
    for (const option of picker.options.slice(1)) {
      expect(option.source).toBe("curated");
      expect(option.thumbnailDataUri).toMatch(/^data:image\/png;base64,/);
    }
  });

  it("the font-picker getValue/setValue read and write family+source purely", async () => {
    const font = (await loadGroups()).find((g) => g.id === "font");
    const picker = font.controls.find((c) => c.id === "font-picker");

    const state = { card: { font: { family: "Yuyu", source: "curated" } } };
    expect(picker.getValue(state)).toEqual({ family: "Yuyu", source: "curated" });

    const next = picker.setValue(state, { family: "Comic Neue", source: "builtin" });
    expect(next.card.font.family).toBe("Comic Neue");
    expect(next.card.font.source).toBe("builtin");
    // Purity: original state untouched.
    expect(state.card.font.family).toBe("Yuyu");
  });

  it("the custom-family text control only reflects a value when source is 'custom'", async () => {
    const font = (await loadGroups()).find((g) => g.id === "font");
    const custom = font.controls.find((c) => c.id === "font-custom");

    expect(custom.getValue({ card: { font: { family: "Yuyu", source: "curated" } } })).toBe("");
    expect(custom.getValue({ card: { font: { family: "Bangers", source: "custom" } } })).toBe("Bangers");

    const next = custom.setValue({ card: { font: {} } }, "Bangers");
    expect(next.card.font).toEqual({ family: "Bangers", source: "custom" });
  });

  it("size and letter-spacing sliders read/write numeric card.font fields", async () => {
    const font = (await loadGroups()).find((g) => g.id === "font");
    const size = font.controls.find((c) => c.id === "font-size");
    const spacing = font.controls.find((c) => c.id === "letter-spacing");

    expect(size.getValue({ card: { font: { sizePt: 32 } } })).toBe(32);
    expect(size.setValue({ card: { font: {} } }, "40").card.font.sizePt).toBe(40);

    expect(spacing.getValue({ card: { font: {} } })).toBe(0);
    expect(spacing.setValue({ card: { font: {} } }, "1.5").card.font.letterSpacingMm).toBe(1.5);
  });
});
