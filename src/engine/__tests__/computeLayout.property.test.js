import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { computeLayout } from "../computeLayout.js";
import { createStubEnv } from "./stubEnv.js";

/**
 * Property-based determinism check (fast-check), per SPEC.md "Testing
 * Decisions": determinism should hold for ANY state, not just one example.
 * This also proves fast-check is wired for issue #1's acceptance criteria.
 */
describe("computeLayout (property-based scaffold seam)", () => {
  it("is deterministic for arbitrary single-line text and seeds", () => {
    fc.assert(
      fc.property(fc.string(), fc.integer(), (text, seed) => {
        const state = { schemaVersion: 1, text, seed };
        const env = createStubEnv();

        const first = computeLayout(state, env);
        const second = computeLayout(state, env);

        expect(second).toEqual(first);
      }),
    );
  });
});
