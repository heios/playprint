import { afterEach, describe, expect, it } from "vitest";
import { _resetRegistryForTests, getRegisteredControlGroups, registerControlGroup } from "../registry.js";

describe("control-registration API", () => {
  afterEach(() => {
    _resetRegistryForTests();
  });

  it("starts empty", () => {
    expect(getRegisteredControlGroups()).toEqual([]);
  });

  it("returns a group after it registers itself", () => {
    registerControlGroup({ id: "example", label: "Example", controls: [] });

    const groups = getRegisteredControlGroups();

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ id: "example", label: "Example" });
  });

  it("preserves registration order across multiple independent groups", () => {
    registerControlGroup({ id: "first", label: "First", controls: [] });
    registerControlGroup({ id: "second", label: "Second", controls: [] });

    expect(getRegisteredControlGroups().map((g) => g.id)).toEqual(["first", "second"]);
  });

  it("rejects a second group registered under the same id", () => {
    registerControlGroup({ id: "dup", label: "Dup", controls: [] });

    expect(() => registerControlGroup({ id: "dup", label: "Dup again", controls: [] })).toThrow();
  });

  it("returns a defensive copy, so mutating the returned array cannot affect the registry", () => {
    registerControlGroup({ id: "solo", label: "Solo", controls: [] });

    const groups = getRegisteredControlGroups();
    groups.push({ id: "intruder", label: "Intruder", controls: [] });

    expect(getRegisteredControlGroups()).toHaveLength(1);
  });
});
