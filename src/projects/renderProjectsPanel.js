import { listProjects, createProject, saveProject, loadProject, renameProject, duplicateProject, deleteProject } from "../state/projectsStore.js";
import { buildShareUrl } from "../state/shareUrl.js";

/**
 * Thin DOM chrome for SPEC.md stories 58-62 ("Projects & sharing"): a panel
 * listing named projects (create/save/rename/duplicate/delete) over
 * `state/projectsStore.js`, a persistent local-only/unrecoverable warning
 * (story 60), and a "Copy share link" button over `state/shareUrl.js`
 * (stories 61-62). Not unit-tested against the DOM (SPEC.md "Testing
 * Decisions": the tested seam is the pure store/serialize modules this
 * merely calls) — mirrors `renderControls.js`'s role for control groups.
 *
 * @param {HTMLElement} container
 * @param {Storage} storage - injected localStorage-like adapter.
 * @param {object} state - current ProjectState.
 * @param {(next: object) => void} onChange - called with a new state after
 *   any action that changes it (loading/creating/duplicating a project).
 * @param {{ activeProjectId: string|null, locationHref: string, onCopyLink: (url: string) => void }} extra
 */
export function renderProjectsPanel(container, storage, state, onChange, extra) {
  container.replaceChildren();

  const fieldset = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = "Projects";
  fieldset.appendChild(legend);

  const warning = document.createElement("p");
  warning.className = "projects-warning";
  warning.textContent =
    "Projects are stored only in this browser (localStorage). Clearing your browser data, using a different browser/device, or private/incognito mode will lose them permanently — they cannot be recovered.";
  fieldset.appendChild(warning);

  const list = document.createElement("ul");
  list.className = "projects-list";
  for (const project of listProjects(storage)) {
    list.appendChild(renderProjectRow(project, storage, state, onChange, extra));
  }
  fieldset.appendChild(list);

  const newButton = document.createElement("button");
  newButton.type = "button";
  newButton.textContent = "Save as new project";
  newButton.addEventListener("click", () => {
    const project = createProject(storage, state);
    onChange(state, project.id);
  });
  fieldset.appendChild(newButton);

  const shareButton = document.createElement("button");
  shareButton.type = "button";
  shareButton.textContent = "Copy share link";
  shareButton.addEventListener("click", () => {
    const url = buildShareUrl(extra.locationHref, state);
    extra.onCopyLink(url);
  });
  fieldset.appendChild(shareButton);

  container.appendChild(fieldset);
}

function renderProjectRow(project, storage, state, onChange, extra) {
  const li = document.createElement("li");
  li.className = "projects-row";
  if (project.id === extra.activeProjectId) li.classList.add("active");

  const nameEl = document.createElement("span");
  nameEl.textContent = project.name;
  li.appendChild(nameEl);

  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.textContent = "Open";
  openButton.addEventListener("click", () => {
    const loaded = loadProject(storage, project.id);
    if (loaded) onChange(loaded, project.id);
  });
  li.appendChild(openButton);

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.textContent = "Save";
  saveButton.disabled = project.id !== extra.activeProjectId;
  saveButton.addEventListener("click", () => {
    saveProject(storage, project.id, state);
    onChange(state, project.id);
  });
  li.appendChild(saveButton);

  const renameButton = document.createElement("button");
  renameButton.type = "button";
  renameButton.textContent = "Rename";
  renameButton.addEventListener("click", () => {
    const next = extra.prompt(`Rename "${project.name}" to:`, project.name);
    if (next && next.trim()) {
      renameProject(storage, project.id, next.trim());
      onChange(project.id === extra.activeProjectId ? { ...state, name: next.trim() } : state, extra.activeProjectId);
    }
  });
  li.appendChild(renameButton);

  const duplicateButton = document.createElement("button");
  duplicateButton.type = "button";
  duplicateButton.textContent = "Duplicate";
  duplicateButton.addEventListener("click", () => {
    duplicateProject(storage, project.id);
    onChange(state, extra.activeProjectId);
  });
  li.appendChild(duplicateButton);

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", () => {
    if (!extra.confirm(`Delete project "${project.name}"? This cannot be undone.`)) return;
    deleteProject(storage, project.id);
    onChange(state, project.id === extra.activeProjectId ? null : extra.activeProjectId);
  });
  li.appendChild(deleteButton);

  return li;
}
