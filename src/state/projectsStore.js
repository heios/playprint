import { encodeState, decodeState } from "./serializeState.js";

/**
 * Named projects persisted in localStorage (SPEC.md stories 58-60,
 * "Projects & sharing" — create/save/rename/duplicate/delete). This is a
 * thin CRUD layer over `serializeState.js`'s `encode`/`decode`: every
 * project's `ProjectState` is stored as the exact same compact/compressed
 * payload string `shareUrl.js` puts in a URL hash, so "save as a project"
 * and "copy a share link" are two thin wrappers around one format.
 *
 * The storage backend is INJECTED (`storage`: anything with the
 * `Storage`-like `getItem`/`setItem`/`removeItem` shape) rather than reaching
 * for `window.localStorage` directly — mirrors the engine's `env` injection
 * pattern (SPEC.md "any DOM ... dependency is injected") so this module is
 * unit-testable with a fake store and a real page just passes
 * `window.localStorage`.
 *
 * SPEC.md story 60 ("clear warning ... local-only, unrecoverable") is a UI
 * concern rendered once, persistently, wherever this store is wired into the
 * page — not something this data layer needs to encode.
 *
 * Storage shape: one index key holding an ordered list of
 * `{ id, name }`, plus one key per project id holding its encoded state
 * payload. Kept as two kinds of keys (rather than one giant JSON blob) so
 * saving one project never rewrites every other project's payload.
 */
const INDEX_KEY = "playprint:projects:index";
const PROJECT_KEY_PREFIX = "playprint:projects:";

/**
 * @param {Storage} storage
 * @returns {{ id: string, name: string }[]} all projects, in creation order.
 */
export function listProjects(storage) {
  return readIndex(storage);
}

/**
 * @param {Storage} storage
 * @param {object} state - a `ProjectState` to persist as a brand-new project.
 * @returns {{ id: string, name: string }} the created project's index entry.
 */
export function createProject(storage, state) {
  const id = generateId();
  const name = state?.name?.trim() ? state.name : "Untitled";
  const namedState = { ...state, name };

  writeIndex(storage, [...readIndex(storage), { id, name }]);
  storage.setItem(PROJECT_KEY_PREFIX + id, encodeState(namedState));

  return { id, name };
}

/**
 * Overwrites an existing project's persisted state (SPEC.md story 58,
 * "save"). No-op on the index (name unchanged) — use `renameProject` to
 * change the name.
 * @param {Storage} storage
 * @param {string} id
 * @param {object} state
 */
export function saveProject(storage, id, state) {
  storage.setItem(PROJECT_KEY_PREFIX + id, encodeState(state));
}

/**
 * @param {Storage} storage
 * @param {string} id
 * @returns {object|null} the project's `ProjectState`, or `null` if `id`
 *   isn't a known project (never throws on a missing/stale id).
 */
export function loadProject(storage, id) {
  const payload = storage.getItem(PROJECT_KEY_PREFIX + id);
  if (payload === null || payload === undefined) return null;
  return decodeState(payload);
}

/**
 * Renames a project: updates both the index entry (what project lists show)
 * and the persisted state's own `name` field (so a reloaded/shared project
 * still carries the name it was last known by).
 * @param {Storage} storage
 * @param {string} id
 * @param {string} name
 */
export function renameProject(storage, id, name) {
  const index = readIndex(storage);
  writeIndex(
    storage,
    index.map((entry) => (entry.id === id ? { ...entry, name } : entry)),
  );

  const state = loadProject(storage, id);
  if (state) saveProject(storage, id, { ...state, name });
}

/**
 * Duplicates a project as a new, independent entry (SPEC.md story 59).
 * @param {Storage} storage
 * @param {string} id - the project to copy.
 * @returns {{ id: string, name: string }} the new project's index entry.
 */
export function duplicateProject(storage, id) {
  const state = loadProject(storage, id);
  if (!state) throw new Error(`duplicateProject: no project with id "${id}"`);

  const sourceEntry = readIndex(storage).find((entry) => entry.id === id);
  const copyName = `${sourceEntry?.name ?? state.name} copy`;
  return createProject(storage, { ...state, name: copyName });
}

/**
 * @param {Storage} storage
 * @param {string} id
 */
export function deleteProject(storage, id) {
  writeIndex(
    storage,
    readIndex(storage).filter((entry) => entry.id !== id),
  );
  storage.removeItem(PROJECT_KEY_PREFIX + id);
}

function readIndex(storage) {
  const raw = storage.getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIndex(storage, index) {
  storage.setItem(INDEX_KEY, JSON.stringify(index));
}

function generateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
