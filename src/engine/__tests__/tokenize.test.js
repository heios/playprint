import { describe, expect, it } from "vitest";
import { tokenize } from "../passes/tokenize.js";

/**
 * Each pipeline pass is independently testable in isolation — proving the
 * module boundaries in the tokenize → size → place → letterTransforms →
 * mat → paginate pipeline are real, not just an internal detail of
 * computeLayout. tokenize is purely structural: it turns text into rows of
 * tokens; geometric soft-wrap happens later in `place` where widths are known.
 */
describe("tokenize pass", () => {
  it("splits whitespace-separated text into rows of tokens", () => {
    const { doc } = tokenize({ state: { text: "January February" } });
    expect(doc.rows).toEqual([["January", "February"]]);
  });

  it("treats newlines as hard row breaks", () => {
    const { doc } = tokenize({ state: { text: "one two\nthree" } });
    expect(doc.rows).toEqual([["one", "two"], ["three"]]);
  });

  it("keeps a blank line as an empty row", () => {
    const { doc } = tokenize({ state: { text: "a\n\nb" } });
    expect(doc.rows).toEqual([["a"], [], ["b"]]);
  });

  it("keeps duplicate tokens (so 1 1 2 2 builds dates)", () => {
    const { doc } = tokenize({ state: { text: "1 1 2 2" } });
    expect(doc.rows).toEqual([["1", "1", "2", "2"]]);
  });

  it("emits no rows for empty text", () => {
    expect(tokenize({ state: { text: "" } }).doc.rows).toEqual([]);
  });

  it("collapses runs of spaces and tabs within a line", () => {
    const { doc } = tokenize({ state: { text: "a   \t  b" } });
    expect(doc.rows).toEqual([["a", "b"]]);
  });
});
