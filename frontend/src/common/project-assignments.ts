import type { Project } from "./types";

function uniqueNames(values: Array<string | undefined>) {
  const names = new Map<string, string>();
  for (const value of values) {
    const name = value?.trim();
    if (name && name.toLowerCase() !== "unassigned" && !names.has(name.toLowerCase())) {
      names.set(name.toLowerCase(), name);
    }
  }
  return [...names.values()];
}

export function getProjectEngineers(project: Pick<Project, "engineer" | "engineers">) {
  return uniqueNames([...(project.engineers ?? []), project.engineer]);
}

export function getProjectManagers(project: Pick<Project, "projectManager" | "projectManagers">) {
  return uniqueNames([...(project.projectManagers ?? []), project.projectManager]);
}
