import { createClientCredential, createEmployeeCredential, deleteClientCredential, deleteEmployeeCredential, nextId, people, projects, readText } from "../../data/store";
import { failure, result } from "../shared";

export const listPeople = () => people;

export function createPerson(body: any) {
  const name = readText(body?.name);
  const email = readText(body?.email);
  const project = readText(body?.project);
  const password = readText(body?.password);
  const role = body?.role;
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    (role !== "Client" && role !== "Site Engineer") || (role === "Client" && !project) ||
    !password || password.length < 8) {
    return failure(400, "Enter valid name and email, assign clients to a project, and provide a password of at least 8 characters.");
  }
  if (role === "Client" && !projects.some((item) => item.name === project)) {
    return failure(400, "Select an existing project to assign to this client.");
  }
  if (people.some((person) => person.email.toLowerCase() === email.toLowerCase())) {
    return failure(409, "A person with this email already exists.");
  }
  const person = { id: nextId("person"), name, email, role, project: project ?? "No assigned sites" };
  if (role === "Client") {
    const assignedProject = projects.find((item) => item.name === project);
    if (assignedProject) assignedProject.client = name;
  }
  people.unshift(person);
  if (role === "Site Engineer") createEmployeeCredential(email.toLowerCase(), password);
  else createClientCredential(email.toLowerCase(), password);
  return result({ record: person }, 201);
}

export function deletePerson(id: string) {
  const index = people.findIndex((person) => person.id === id);
  if (index < 0) return failure(404, "Person not found.");
  const [record] = people.splice(index, 1);
  if (record.role === "Site Engineer") deleteEmployeeCredential(record.email.toLowerCase());
  else deleteClientCredential(record.email.toLowerCase());
  return result({ record });
}
