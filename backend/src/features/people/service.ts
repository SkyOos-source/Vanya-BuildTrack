import { nextId, readText } from "../../data/store";
import { failure, result } from "../shared";
import { people } from "./data";

export const listPeople = () => people;

export function createPerson(body: any) {
  const name = readText(body?.name);
  const email = readText(body?.email);
  const project = readText(body?.project);
  const role = body?.role;
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    (role !== "Client" && role !== "Site Engineer") || (role === "Client" && !project)) {
    return failure(400, "Valid name, email, and role are required; clients also need a project.");
  }
  const person = { id: nextId("person"), name, email, role, project: project ?? "No assigned sites" };
  people.unshift(person);
  return result({ record: person }, 201);
}

export function deletePerson(id: string) {
  const index = people.findIndex((person) => person.id === id);
  if (index < 0) return failure(404, "Person not found.");
  const [record] = people.splice(index, 1);
  return result({ record });
}
