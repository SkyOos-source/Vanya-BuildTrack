import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { prisma } from "../prisma";
import { initialOwnerAccount } from "../features/auth/data";


export type Project = {
  id: string;
  name: string;
  site: string;
  client: string;
  engineer: string;
  status: string;
  progress: number;
  quotationAmount?: number;
  budget: number;
  spent: number;
  dueDate: string;
  image: string;
};

export type Quote = {
  id: string;
  project: string;
  title: string;
  client: string;
  amount: number;
  date: string;
  status: string;
  attachment?: string;
};

export type Expense = {
  id: string;
  project: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  submittedBy: string;
  status: string;
  attachment?: string;
};

export type SiteVisit = {
  id: string;
  project: string;
  site: string;
  engineer: string;
  date: string;
  time: string;
  status: string;
};

export type Activity = {
  id: string;
  actor: string;
  action: string;
  project: string;
  time: string;
  kind: string;
  stage?: "Start" | "Progress" | "Completion";
  description?: string;
  attachment?: string;
  attachments?: string[];
  createdAt?: string;
};
export type Material = { id: string; material: string; project: string; received: string; used: string; stock: string; lastUpdated: string; submittedBy?: string };
export type MaterialRequest = { id: string; material: string; project: string; quantity: string; requestedBy: string; note?: string; requestedAt: string; status: string };
export type AttendanceProof = { image: string; capturedAt: string; latitude: number; longitude: number; accuracy: number };
export type AttendanceRegularization = { capturedAt: string; reason: string; regularizedBy: string; regularizedAt: string };
export type Attendance = { id: string; project?: string; engineer: string; present: string; shift: string; status: string; evidence: string; date?: string; checkIn?: AttendanceProof; checkOut?: AttendanceProof; checkoutRegularization?: AttendanceRegularization };
export type AttendanceLeave = { id: string; title: string; date: string };
export type Feedback = { id: string; project: string; client: string; rating: number; comment: string; date: string };
export type Backup = { id: string; status: string; requestedAt: string; requestedBy: string };
export type Person = { id: string; name: string; role: "Client" | "Site Engineer"; project: string; email: string; phone?: string; image?: string };
export const ownerProfile = { phone: "", image: "" };
export type OwnerAccount = { email: string; name: string; salt: string; passwordHash: string };
export type PushSubscriptionRecord = { endpoint: string; keys: { p256dh: string; auth: string }; role: DemoRole; userName: string };
export type EmployeeCredential = { email: string; salt: string; passwordHash: string };
export type DemoRole = "owner" | "employee" | "client";

export const projects: Project[] = [];

export const quotations: Quote[] = [];

export const expenses: Expense[] = [];

export const siteVisits: SiteVisit[] = [];

export const activities: Activity[] = [];
export const materials: Material[] = [];
export const materialRequests: MaterialRequest[] = [];
export const attendance: Attendance[] = [];
export const attendanceLeaves: AttendanceLeave[] = [];
export const feedback: Feedback[] = [];
export const backups: Backup[] = [];
export const people: Person[] = [];

export const employeeCredentials: EmployeeCredential[] = [];
export const clientCredentials: EmployeeCredential[] = [];
export const pushSubscriptions: PushSubscriptionRecord[] = [];
export const ownerAccount: OwnerAccount = { email: "", name: "", salt: "", passwordHash: "" };

export const store = { projects, quotations, expenses, siteVisits, activities, materials, materialRequests, attendance, attendanceLeaves, feedback, backups, people, pushSubscriptions, ownerProfile, ownerAccount };
let projectSequence = 1;
let quotationSequence = 1;
let expenseSequence = 1;
let visitSequence = 1;
let updateSequence = 1;
let attendanceSequence = 1;
let materialSequence = 1;
let materialRequestSequence = 1;
let personSequence = 1;

export function readText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function readAmount(value: unknown): number | null {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function readProject(value: unknown, id: string): Project | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const name = readText(input.name);
  const budget = input.budget === undefined ? 0 : readAmount(input.budget);
  const quotationAmount = input.quotationAmount === undefined ? 0 : readAmount(input.quotationAmount);
  const spent = input.spent === undefined ? 0 : readAmount(input.spent);
  const progress = input.progress === undefined ? 0 : readAmount(input.progress);
  if (!name || quotationAmount === null || budget === null || spent === null || progress === null || progress > 100) return null;
  return {
    id,
    name,
    site: readText(input.site) ?? "New project site",
    client: readText(input.client) ?? "Unassigned",
    engineer: readText(input.engineer) ?? "Unassigned",
    status: readText(input.status) ?? "Planning",
    progress,
    quotationAmount,
    budget,
    spent,
    dueDate: readText(input.dueDate) ?? "To be confirmed",
    image: readText(input.image) ?? "photo-1600585154340-be6161a56a0c"
  };
}

export function readAttachment(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" ||
    !/^data:(image\/(jpeg|png|webp)|application\/pdf);base64,[A-Za-z0-9+/]+=*$/.test(value) ||
    value.length > 2_500_000) {
    return null;
  }
  return value;
}

export function readPdfAttachment(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" ||
    !/^data:application\/pdf;base64,[A-Za-z0-9+/]+=*$/.test(value) ||
    value.length > 2_500_000) {
    return null;
  }
  const contents = Buffer.from(value.slice("data:application/pdf;base64,".length), "base64");
  return contents.subarray(0, 5).toString("ascii") === "%PDF-" ? value : null;
}

export function readAttendanceProof(value: unknown): AttendanceProof | null {
  if (!value || typeof value !== "object") return null;
  const proof = value as Record<string, unknown>;
  if (typeof proof.image !== "string" ||
    !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(proof.image) ||
    proof.image.length > 2_500_000 ||
    typeof proof.capturedAt !== "string" ||
    !Number.isFinite(Date.parse(proof.capturedAt)) ||
    typeof proof.latitude !== "number" || proof.latitude < -90 || proof.latitude > 90 ||
    typeof proof.longitude !== "number" || proof.longitude < -180 || proof.longitude > 180 ||
    typeof proof.accuracy !== "number" || !Number.isFinite(proof.accuracy) || proof.accuracy < 0) {
    return null;
  }
  return {
    image: proof.image,
    capturedAt: proof.capturedAt,
    latitude: proof.latitude,
    longitude: proof.longitude,
    accuracy: proof.accuracy
  };
}

export function isDemoRole(value: unknown): value is DemoRole {
  return value === "owner" || value === "employee" || value === "client";
}

function seedOwnerAccount() {
  const salt = randomBytes(16).toString("hex");
  Object.assign(ownerAccount, {
    email: initialOwnerAccount.email.toLowerCase(),
    name: initialOwnerAccount.name,
    salt,
    passwordHash: scryptSync(initialOwnerAccount.password, salt, 64).toString("hex")
  });
}

export async function initializeStore() {
  const savedState = await prisma.appState.findUnique({ where: { id: "workspace" } });
  if (!savedState) {
    seedOwnerAccount();
    await saveStore();
    return;
  }
  const parsed: unknown = JSON.parse(savedState.payload);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("SQLite workspace state has an invalid top-level structure.");
  }
  const saved = parsed as Record<string, unknown>;
  const restore = <T>(target: T[], key: string) => {
    const records = saved[key];
    if (records === undefined) return;
    if (!Array.isArray(records)) throw new Error(`SQLite workspace state field '${key}' must be an array.`);
    target.splice(0, target.length, ...(records as T[]));
  };
  restore(projects, "projects");
  restore(quotations, "quotations");
  restore(expenses, "expenses");
  restore(siteVisits, "siteVisits");
  restore(activities, "activities");
  restore(materials, "materials");
  restore(materialRequests, "materialRequests");
  restore(attendance, "attendance");
  restore(attendanceLeaves, "attendanceLeaves");
  restore(feedback, "feedback");
  restore(backups, "backups");
  restore(people, "people");
  restore(employeeCredentials, "employeeCredentials");
  restore(clientCredentials, "clientCredentials");
  restore(pushSubscriptions, "pushSubscriptions");
  if (saved.ownerProfile && typeof saved.ownerProfile === "object") {
    const savedOwnerProfile = saved.ownerProfile as { phone?: unknown; image?: unknown };
    ownerProfile.phone = typeof savedOwnerProfile.phone === "string" ? savedOwnerProfile.phone : "";
    ownerProfile.image = typeof savedOwnerProfile.image === "string" ? savedOwnerProfile.image : "";
  }
  if (saved.ownerAccount && typeof saved.ownerAccount === "object") {
    Object.assign(ownerAccount, saved.ownerAccount);
  } else {
    seedOwnerAccount();
  }
  projectSequence = nextSequence(projects, "PRJ-", projectSequence);
  quotationSequence = nextSequence(quotations, "QT-", quotationSequence);
  expenseSequence = nextSequence(expenses, "EXP-", expenseSequence);
  visitSequence = nextSequence(siteVisits, "VIS-", visitSequence);
  attendanceSequence = nextSequence(attendance, "ATT-", attendanceSequence);
  materialSequence = nextSequence(materials, "MAT-", materialSequence);
  materialRequestSequence = nextSequence(materialRequests, "MREQ-", materialRequestSequence);
  personSequence = nextSequence(people, "USR-", personSequence);
  updateSequence = nextSequence(activities, "UPD-", updateSequence);
}

export function nextSequence(records: Array<{ id: string }>, prefix: string, fallback: number) {
  const highest = records.reduce((max, record) => {
    const sequence = Number(record.id.replace(prefix, ""));
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 0);
  return Math.max(fallback, highest + 1);
}

export async function saveStore() {
  await prisma.appState.upsert({
    where: { id: "workspace" },
    create: { id: "workspace", payload: JSON.stringify({ ...store, employeeCredentials, clientCredentials }) },
    update: { payload: JSON.stringify({ ...store, employeeCredentials, clientCredentials }) }
  });
}

export function verifyOwnerCredential(email: string, password: string) {
  if (!ownerAccount.salt || !ownerAccount.passwordHash || ownerAccount.email !== email) return false;
  const actual = scryptSync(password, ownerAccount.salt, 64);
  const expected = Buffer.from(ownerAccount.passwordHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createEmployeeCredential(email: string, password: string) {
  const salt = randomBytes(16).toString("hex");
  employeeCredentials.push({ email, salt, passwordHash: scryptSync(password, salt, 64).toString("hex") });
}

export function verifyEmployeeCredential(email: string, password: string) {
  const credential = employeeCredentials.find((item) => item.email === email);
  if (!credential) return false;
  const actual = scryptSync(password, credential.salt, 64);
  const expected = Buffer.from(credential.passwordHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function deleteEmployeeCredential(email: string) {
  const index = employeeCredentials.findIndex((item) => item.email === email);
  if (index >= 0) employeeCredentials.splice(index, 1);
}

export function createClientCredential(email: string, password: string) {
  const salt = randomBytes(16).toString("hex");
  clientCredentials.push({ email, salt, passwordHash: scryptSync(password, salt, 64).toString("hex") });
}

export function verifyClientCredential(email: string, password: string) {
  const credential = clientCredentials.find((item) => item.email === email);
  if (!credential) return false;
  const actual = scryptSync(password, credential.salt, 64);
  const expected = Buffer.from(credential.passwordHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function deleteClientCredential(email: string) {
  const index = clientCredentials.findIndex((item) => item.email === email);
  if (index >= 0) clientCredentials.splice(index, 1);
}

export function nextAttendanceLeaveId() {
  const sequence = attendanceLeaves.reduce((max, leave) => {
    const number = Number(leave.id.replace("LEV-", ""));
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0) + 1;
  return `LEV-${String(sequence).padStart(3, "0")}`;
}

export function nextId(kind: string): string {
  const values: Record<string, { prefix: string; next: () => number }> = {
    project: { prefix: "PRJ-", next: () => projectSequence++ },
    quotation: { prefix: "QT-", next: () => quotationSequence++ },
    expense: { prefix: "EXP-", next: () => expenseSequence++ },
    visit: { prefix: "VIS-", next: () => visitSequence++ },
    progress: { prefix: "UPD-", next: () => updateSequence++ },
    attendance: { prefix: "ATT-", next: () => attendanceSequence++ },
    material: { prefix: "MAT-", next: () => materialSequence++ },
    "material-request": { prefix: "MREQ-", next: () => materialRequestSequence++ },
    person: { prefix: "USR-", next: () => personSequence++ }
  };
  const sequence = values[kind];
  if (!sequence) throw new Error(`Unknown sequence: ${kind}`);
  const number = sequence.next();
  const width = kind === "project" || kind === "person" ? 3 : kind === "attendance" || kind === "material" ? 2 : 0;
  return `${sequence.prefix}${width ? String(number).padStart(width, "0") : number}`;
}
