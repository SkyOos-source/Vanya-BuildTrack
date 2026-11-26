import { nextId, people, readProject, readText } from "../../data/store";
import { projects } from "./data";
import { failure, result } from "../shared";

export const listProjects = () => projects;

function selectedNames(body: any, pluralKey: "engineers" | "projectManagers", singularKey: "engineer" | "projectManager", required: boolean) {
  const plural = body?.[pluralKey];
  if (plural !== undefined && (!Array.isArray(plural) || plural.some((value: unknown) => typeof value !== "string"))) return null;
  const candidates = [...(Array.isArray(plural) ? plural : []), body?.[singularKey]]
    .map(readText)
    .filter((name: string | null): name is string => name !== null && name.toLowerCase() !== "unassigned");
  const unique = [...new Map(candidates.map((name) => [name.toLowerCase(), name])).values()];
  return required && unique.length === 0 ? null : unique;
}

function validAssignees(names: string[], role: "Site Engineer" | "Project Manager") {
  return names.every((name) => people.some((person) => person.role === role && person.name.toLowerCase() === name.toLowerCase()));
}

export function createProject(body: any) {
  const name = readText(body?.name);
  const site = readText(body?.site);
  const engineers = selectedNames(body, "engineers", "engineer", true);
  const projectManagers = selectedNames(body, "projectManagers", "projectManager", false);
  if (name && projects.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
    return failure(409, "A project with this name already exists.");
  }
  if (!name || !site || !engineers) {
    return failure(400, "Project name, location, and at least one engineer are required.");
  }
  if (!validAssignees(engineers, "Site Engineer") || !projectManagers || !validAssignees(projectManagers, "Project Manager")) {
    return failure(400, "Select existing engineers and project managers for this site.");
  }
  const project = readProject({
    ...body,
    name,
    site,
    engineer: engineers[0] ?? "Unassigned",
    engineers,
    projectManager: projectManagers[0] ?? "Unassigned",
    projectManagers,
    quotationAmount: 0,
    budget: 0,
    spent: 0,
    progress: 0
  }, "");
  if (!project) return failure(400, "Project fields are invalid.");
  project.id = nextId("project");
  projects.unshift(project);
  return result({ record: project }, 201);
}

export function updateProject(id: string, body: any) {
  const project = projects.find((item) => item.id === id);
  if (!project) return failure(404, "Project not found.");
  const input = { ...project, ...body };
  if (body?.engineers !== undefined || body?.engineer !== undefined) {
    input.engineers = body?.engineers !== undefined ? body.engineers : [body.engineer];
    input.engineer = body?.engineer ?? (Array.isArray(body?.engineers) ? body.engineers[0] : "Unassigned");
  }
  if (body?.projectManagers !== undefined || body?.projectManager !== undefined) {
    input.projectManagers = body?.projectManagers !== undefined ? body.projectManagers : [body.projectManager];
    input.projectManager = body?.projectManager ?? (Array.isArray(body?.projectManagers) ? body.projectManagers[0] : "Unassigned");
  }
  const engineers = selectedNames(input, "engineers", "engineer", false);
  const projectManagers = selectedNames(input, "projectManagers", "projectManager", false);
  if (!engineers || !projectManagers || !validAssignees(engineers, "Site Engineer") ||
    !validAssignees(projectManagers, "Project Manager")) {
    return failure(400, "Selected engineers and project managers must be active workspace team members.");
  }
  input.engineers = engineers;
  input.engineer = engineers[0];
  input.projectManagers = projectManagers;
  input.projectManager = projectManagers[0] ?? "Unassigned";
  const updated = readProject(input, project.id);
  if (!updated) return failure(400, "Project fields are invalid.");
  if (projects.some((item) => item.id !== id && item.name.toLowerCase() === updated.name.toLowerCase())) {
    return failure(409, "A project with this name already exists.");
  }
  Object.assign(project, updated);
  return result({ record: project });
}

export function deleteProject(id: string) {
  const index = projects.findIndex((item) => item.id === id);
  if (index < 0) return failure(404, "Project not found.");
  const [record] = projects.splice(index, 1);
  return result({ record });
}
