import { nextId, readProject } from "../../data/store";
import { projects } from "./data";
import { failure, result } from "../shared";

export const listProjects = () => projects;

export function createProject(body: any) {
  const project = readProject(body, "");
  if (!project) return failure(400, "Project name and valid budget, spending, and progress values are required.");
  if (projects.some((item) => item.name.toLowerCase() === project.name.toLowerCase())) {
    return failure(409, "A project with this name already exists.");
  }
  project.id = nextId("project");
  projects.unshift(project);
  return result({ record: project }, 201);
}

export function updateProject(id: string, body: any) {
  const project = projects.find((item) => item.id === id);
  if (!project) return failure(404, "Project not found.");
  const updated = readProject({ ...project, ...body }, project.id);
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
