import { activities, attendance, createClientCredential, createEmployeeCredential, deleteClientCredential, deleteEmployeeCredential, expenses, feedback, materials, materialRequests, nextId, people, projects, quotations, readText, siteVisits, updatePersonCredentialEmail } from "../../data/store";
import { failure, result } from "../shared";

export const listPeople = () => people;

function normalizePhone(value: unknown) {
  if (typeof value !== "string" || !/^\+?[\d\s().-]+$/.test(value.trim())) return null;
  const phone = value.trim().replace(/[\s().-]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

export function createPerson(body: any) {
  const name = readText(body?.name);
  const email = readText(body?.email);
  const project = readText(body?.project);
  const password = readText(body?.password);
  const phone = normalizePhone(body?.phone);
  const role = body?.role;
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    (role !== "Client" && role !== "Site Engineer") || (role === "Client" && !project) ||
    !password || password.length < 8 || !phone) {
    return failure(400, "Enter valid name, email, and international phone number (+country code), assign clients to a project, and provide a password of at least 8 characters.");
  }
  if (role === "Client" && !projects.some((item) => item.name === project)) {
    return failure(400, "Select an existing project to assign to this client.");
  }
  if (people.some((person) => person.email.toLowerCase() === email.toLowerCase())) {
    return failure(409, "A person with this email already exists.");
  }
  const person = { id: nextId("person"), name, email, role, project: project ?? "No assigned sites", phone, phoneVerified: false };
  if (role === "Client") {
    const assignedProject = projects.find((item) => item.name === project);
    if (assignedProject) assignedProject.client = name;
  }
  people.unshift(person);
  if (role === "Site Engineer") createEmployeeCredential(email.toLowerCase(), password);
  else createClientCredential(email.toLowerCase(), password);
  return result({ record: person }, 201);
}

export function updatePerson(id: string, body: any) {
  const person = people.find((item) => item.id === id);
  if (!person) return failure(404, "Person not found.");
  const name = readText(body?.name);
  const email = readText(body?.email);
  const phoneInput = typeof body?.phone === "string" ? body.phone.trim() : "";
  const phone = phoneInput ? normalizePhone(phoneInput) : person.phone;
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return failure(400, "Enter a valid name and email address.");
  }
  if (phoneInput && !phone) {
    return failure(400, "Enter a valid international phone number (+country code).");
  }
  if (people.some((item) => item.id !== id && item.email.toLowerCase() === email.toLowerCase())) {
    return failure(409, "A person with this email already exists.");
  }

  const previousName = person.name;
  const previousEmail = person.email.toLowerCase();
  const normalizedEmail = email.toLowerCase();
  person.name = name;
  person.email = email;
  if (typeof phone === "string") {
    if (person.phone !== phone) person.phoneVerified = false;
    person.phone = phone;
  }
  updatePersonCredentialEmail(person.role, previousEmail, normalizedEmail);

  if (person.role === "Client") {
    projects.forEach((project) => { if (project.client === previousName) project.client = name; });
    quotations.forEach((quotation) => { if (quotation.client === previousName) quotation.client = name; });
    feedback.forEach((item) => { if (item.client === previousName) item.client = name; });
  } else {
    projects.forEach((project) => { if (project.engineer === previousName) project.engineer = name; });
    siteVisits.forEach((visit) => { if (visit.engineer === previousName) visit.engineer = name; });
    activities.forEach((activity) => { if (activity.actor === previousName) activity.actor = name; });
    expenses.forEach((expense) => { if (expense.submittedBy === previousName) expense.submittedBy = name; });
    attendance.forEach((record) => { if (record.engineer === previousName) record.engineer = name; });
    materials.forEach((material) => { if (material.submittedBy === previousName) material.submittedBy = name; });
    materialRequests.forEach((request) => { if (request.requestedBy === previousName) request.requestedBy = name; });
  }
  return result({ record: person });
}

export function deletePerson(id: string) {
  const index = people.findIndex((person) => person.id === id);
  if (index < 0) return failure(404, "Person not found.");
  const [record] = people.splice(index, 1);
  if (record.role === "Site Engineer") deleteEmployeeCredential(record.email.toLowerCase());
  else deleteClientCredential(record.email.toLowerCase());
  return result({ record });
}
