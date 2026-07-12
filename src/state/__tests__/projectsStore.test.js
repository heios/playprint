import { describe, expect, it, beforeEach } from "vitest";
import {
  listProjects,
  saveProject,
  loadProject,
  renameProject,
  duplicateProject,
  deleteProject,
  createProject,
} from "../projectsStore.js";
import { defaultState } from "../../engine/defaultState.js";
import { makeState } from "../../engine/__tests__/testState.js";

/**
 * Issue #9 (SPEC.md stories 58-60): named projects persisted in
 * localStorage — create/save/rename/duplicate/delete — as a thin layer over
 * `encode`/`decode` (`serializeState.js`). The storage adapter is injected
 * (mirrors the `env` pattern the engine uses for the DOM) so these are
 * pure-ish unit tests against a fake, deterministic store — no jsdom
 * `localStorage` required, and a real browser swaps in `window.localStorage`
 * unchanged.
 */
function makeFakeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
  };
}

describe("projectsStore", () => {
  let storage;

  beforeEach(() => {
    storage = makeFakeStorage();
  });

  it("starts empty", () => {
    expect(listProjects(storage)).toEqual([]);
  });

  it("creates a named project and lists it", () => {
    const state = makeState({ name: "Birthday cards", text: "Hooray" });
    const project = createProject(storage, state);

    expect(project.id).toBeTruthy();
    expect(project.name).toBe("Birthday cards");

    const listed = listProjects(storage);
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe(project.id);
    expect(listed[0].name).toBe("Birthday cards");
  });

  it("round-trips the exact state through save/load", () => {
    const state = makeState({ name: "Months", text: "January February", seed: 7 });
    const project = createProject(storage, state);

    const loaded = loadProject(storage, project.id);
    expect(loaded).toEqual(state);
  });

  it("saves (overwrites) an existing project's state in place", () => {
    const state = makeState({ name: "Digits", text: "1 2 3" });
    const project = createProject(storage, state);

    const updated = { ...state, text: "1 2 3 4 5" };
    saveProject(storage, project.id, updated);

    expect(loadProject(storage, project.id)).toEqual(updated);
    expect(listProjects(storage)).toHaveLength(1);
  });

  it("renames a project without touching its state", () => {
    const state = makeState({ name: "Old name", text: "abc" });
    const project = createProject(storage, state);

    renameProject(storage, project.id, "New name");

    const listed = listProjects(storage);
    expect(listed[0].name).toBe("New name");
    expect(loadProject(storage, project.id).text).toBe("abc");
    // The persisted state's own `name` field stays in sync with the rename.
    expect(loadProject(storage, project.id).name).toBe("New name");
  });

  it("duplicates a project as a new independent entry", () => {
    const state = makeState({ name: "Original", text: "January" });
    const project = createProject(storage, state);

    const copy = duplicateProject(storage, project.id);

    expect(copy.id).not.toBe(project.id);
    expect(copy.name).toMatch(/Original/);
    expect(listProjects(storage)).toHaveLength(2);

    // Independent: mutating the copy doesn't affect the original.
    saveProject(storage, copy.id, { ...loadProject(storage, copy.id), text: "February" });
    expect(loadProject(storage, project.id).text).toBe("January");
    expect(loadProject(storage, copy.id).text).toBe("February");
  });

  it("deletes a project", () => {
    const a = createProject(storage, makeState({ name: "A" }));
    const b = createProject(storage, makeState({ name: "B" }));

    deleteProject(storage, a.id);

    expect(listProjects(storage).map((p) => p.id)).toEqual([b.id]);
    expect(loadProject(storage, a.id)).toBeNull();
  });

  it("loadProject returns null for an unknown id instead of throwing", () => {
    expect(loadProject(storage, "does-not-exist")).toBeNull();
  });

  it("keeps multiple projects independent in listProjects order (creation order)", () => {
    const a = createProject(storage, makeState({ name: "A" }));
    const b = createProject(storage, makeState({ name: "B" }));
    const c = createProject(storage, makeState({ name: "C" }));

    expect(listProjects(storage).map((p) => p.id)).toEqual([a.id, b.id, c.id]);
  });

  it("survives a fresh store instance reading the same backing storage (persistence)", () => {
    const state = makeState({ name: "Persisted", text: "xyz" });
    const project = createProject(storage, state);

    // Simulate a page reload: a totally new call with the same `storage`.
    expect(listProjects(storage)).toHaveLength(1);
    expect(loadProject(storage, project.id)).toEqual(state);
  });

  it("createProject defaults to defaultState()'s name when state.name is empty", () => {
    const project = createProject(storage, { ...defaultState(), name: "" });
    expect(project.name.length).toBeGreaterThan(0);
  });
});
