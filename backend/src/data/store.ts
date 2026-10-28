import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import path from "node:path";


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
  description?: string;
  attachment?: string;
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
export type Person = { id: string; name: string; role: "Client" | "Site Engineer"; project: string; email: string };
export type PushSubscriptionRecord = { endpoint: string; keys: { p256dh: string; auth: string }; role: DemoRole; userName: string };
export type EmployeeCredential = { email: string; salt: string; passwordHash: string };
export type DemoRole = "owner" | "employee" | "client";

export const projects: Project[] = [
  { id: "PRJ-024", name: "Riverside Residence", site: "Whitefield, Bengaluru", client: "Ananya Rao", engineer: "Arjun Mehta", status: "In progress", progress: 68, budget: 12500000, spent: 8240000, dueDate: "18 Dec 2026", image: "photo-1600585154340-be6161a56a0c" },
  { id: "PRJ-021", name: "Northstar Office Campus", site: "Hebbal, Bengaluru", client: "Northstar Labs", engineer: "Priya Nair", status: "In progress", progress: 42, budget: 28600000, spent: 11350000, dueDate: "02 Mar 2027", image: "photo-1486406146926-c627a92ad1ab" },
  { id: "PRJ-018", name: "Gardenia Villas — Phase II", site: "Sarjapur Road, Bengaluru", client: "Gardenia Estates", engineer: "Arjun Mehta", status: "On track", progress: 86, budget: 19400000, spent: 15620000, dueDate: "29 Nov 2026", image: "photo-1600607687939-ce8a6c25118c" },
  { id: "PRJ-016", name: "Cedar & Stone Café", site: "Indiranagar, Bengaluru", client: "Mira Hospitality", engineer: "Dev Patel", status: "At risk", progress: 31, budget: 6800000, spent: 2410000, dueDate: "14 Jan 2027", image: "photo-1600210492486-724fe5c67fb0" }
];

export const quotations: Quote[] = [
  { id: "QT-1042", project: "Riverside Residence", title: "Kitchen island — add-on work", client: "Ananya Rao", amount: 285000, date: "24 Oct 2026", status: "Awaiting review", attachment: "/sample-quotations/riverside-residence.pdf" },
  { id: "QT-1039", project: "Northstar Office Campus", title: "Foundation & structure", client: "Northstar Labs", amount: 4250000, date: "21 Oct 2026", status: "Sent to client", attachment: "/sample-quotations/northstar-office-campus.pdf" },
  { id: "QT-1034", project: "Gardenia Villas — Phase II", title: "Landscape lighting package", client: "Gardenia Estates", amount: 168000, date: "17 Oct 2026", status: "Approved", attachment: "/sample-quotations/gardenia-villas-phase-ii.pdf" },
  { id: "QT-1028", project: "Cedar & Stone Café", title: "Custom steel canopy", client: "Mira Hospitality", amount: 342000, date: "12 Oct 2026", status: "Changes requested", attachment: "/sample-quotations/cedar-and-stone-cafe.pdf" }
];

export const expenses: Expense[] = [
  { id: "EXP-782", project: "Riverside Residence", category: "Materials", description: "M25 ready-mix concrete · 12 m³", amount: 94000, date: "25 Oct 2026", submittedBy: "Arjun Mehta", status: "Pending review" },
  { id: "EXP-779", project: "Northstar Office Campus", category: "Labour", description: "Structural crew · weekly payment", amount: 128000, date: "24 Oct 2026", submittedBy: "Priya Nair", status: "Pending review" },
  { id: "EXP-776", project: "Gardenia Villas — Phase II", category: "Equipment", description: "Scaffolding rental · 2 weeks", amount: 36500, date: "23 Oct 2026", submittedBy: "Arjun Mehta", status: "Approved" },
  { id: "EXP-771", project: "Cedar & Stone Café", category: "Materials", description: "Powder-coated steel sections", amount: 58200, date: "22 Oct 2026", submittedBy: "Dev Patel", status: "Approved" }
];

export const siteVisits: SiteVisit[] = [
  { id: "VIS-218", project: "Riverside Residence", site: "Whitefield", engineer: "Arjun Mehta", date: "26 Oct 2026", time: "10:30 AM", status: "Scheduled" },
  { id: "VIS-216", project: "Northstar Office Campus", site: "Hebbal", engineer: "Priya Nair", date: "27 Oct 2026", time: "02:00 PM", status: "Scheduled" },
  { id: "VIS-211", project: "Gardenia Villas — Phase II", site: "Sarjapur Road", engineer: "Arjun Mehta", date: "24 Oct 2026", time: "09:00 AM", status: "Completed" }
];

export const activities: Activity[] = [
  { id: "ACT-1", actor: "Arjun Mehta", action: "submitted today's progress update", project: "Riverside Residence", time: "12 min ago", kind: "progress" },
  { id: "ACT-2", actor: "Priya Nair", action: "submitted an expense for review", project: "Northstar Office Campus", time: "48 min ago", kind: "expense" },
  { id: "ACT-3", actor: "Ananya Rao", action: "viewed add-on quotation QT-1042", project: "Riverside Residence", time: "1 hr ago", kind: "quote" },
  { id: "ACT-4", actor: "Dev Patel", action: "marked site attendance for 14 workers", project: "Cedar & Stone Café", time: "2 hrs ago", kind: "attendance" },
  { id: "ACT-5", actor: "Arjun Mehta", action: "recorded 12 m³ of concrete received", project: "Riverside Residence", time: "3 hrs ago", kind: "materials" }
];
export const materials: Material[] = [
  { id: "MAT-01", material: "M25 Ready-mix concrete", project: "Riverside Residence", received: "84 m³", used: "62 m³", stock: "22 m³", lastUpdated: "Today, 9:42 AM" },
  { id: "MAT-02", material: "TMT Steel · Fe 500", project: "Northstar Office Campus", received: "18,400 kg", used: "12,700 kg", stock: "5,700 kg", lastUpdated: "Today, 8:15 AM" },
  { id: "MAT-03", material: "Red clay bricks", project: "Gardenia Villas — Phase II", received: "24,000 pcs", used: "18,500 pcs", stock: "5,500 pcs", lastUpdated: "Yesterday" },
  { id: "MAT-04", material: "OPC Cement · 53 grade", project: "Cedar & Stone Café", received: "860 bags", used: "712 bags", stock: "148 bags", lastUpdated: "22 Oct" }
];
export const materialRequests: MaterialRequest[] = [];
export const attendance: Attendance[] = [
  { id: "ATT-01", project: "Riverside Residence", engineer: "Arjun Mehta", present: "14 / 16", shift: "Full day", status: "Present", evidence: "▧ 2 photos", date: "2026-10-25" },
  { id: "ATT-02", project: "Northstar Office Campus", engineer: "Priya Nair", present: "10 / 12", shift: "Full day", status: "Present", evidence: "▧ 3 photos", date: "2026-10-25" },
  { id: "ATT-03", project: "Gardenia Villas — Phase II", engineer: "Arjun Mehta", present: "—", shift: "—", status: "Weekly Off", evidence: "—", date: "2026-10-25" }
];
export const attendanceLeaves: AttendanceLeave[] = [];
export const feedback: Feedback[] = [
  { id: "FDB-01", project: "Riverside Residence", client: "Ananya Rao", rating: 5, comment: "Great communication throughout the project. Arjun keeps us updated every week and the progress photos are really helpful.", date: "21 Oct 2026" }
];
export const backups: Backup[] = [
  { id: "BKP-008", status: "Ready to download", requestedAt: "20 Oct 2026", requestedBy: "John Smith" }
];
export const people: Person[] = [
  { id: "USR-001", name: "Ananya Rao", role: "Client", project: "Riverside Residence", email: "client@vanya.com" },
  { id: "USR-002", name: "Northstar Labs", role: "Client", project: "Northstar Office Campus", email: "northstar@example.com" },
  { id: "USR-003", name: "Arjun Mehta", role: "Site Engineer", project: "2 active sites", email: "employee@vanya.com" },
  { id: "USR-004", name: "Priya Nair", role: "Site Engineer", project: "Northstar Office Campus", email: "priya@example.com" },
  { id: "USR-005", name: "Dev Patel", role: "Site Engineer", project: "Cedar & Stone Café", email: "dev@example.com" }
];

export const employeeCredentials: EmployeeCredential[] = [];
export const clientCredentials: EmployeeCredential[] = [];
export const pushSubscriptions: PushSubscriptionRecord[] = [];

export const store = { projects, quotations, expenses, siteVisits, activities, materials, materialRequests, attendance, attendanceLeaves, feedback, backups, people, pushSubscriptions };
let projectSequence = 25;
let quotationSequence = 1043;
let expenseSequence = 783;
let visitSequence = 219;
let updateSequence = 1;
let attendanceSequence = 4;
let materialSequence = 5;
let materialRequestSequence = 1;
let personSequence = 6;
const dataDirectory = path.resolve(__dirname, "..", "..", "data");
const dataFile = process.env.BUILDTRACK_DATA_FILE || path.join(dataDirectory, "buildtrack.json");

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

function loadStore() {
  mkdirSync(path.dirname(dataFile), { recursive: true });
  if (!existsSync(dataFile)) {
    saveStore();
    return;
  }
  const parsed: unknown = JSON.parse(readFileSync(dataFile, "utf8"));
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`JSON data file has an invalid top-level structure: ${dataFile}`);
  }
  const saved = parsed as Record<string, unknown>;
  const restore = <T>(target: T[], key: string) => {
    const records = saved[key];
    if (records === undefined) return;
    if (!Array.isArray(records)) throw new Error(`JSON data file field '${key}' must be an array.`);
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

export function saveStore() {
  mkdirSync(path.dirname(dataFile), { recursive: true });
  const temporaryFile = `${dataFile}.tmp`;
  writeFileSync(temporaryFile, JSON.stringify({ ...store, employeeCredentials, clientCredentials }, null, 2), "utf8");
  renameSync(temporaryFile, dataFile);
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

loadStore();
