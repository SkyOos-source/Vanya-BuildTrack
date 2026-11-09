import type { Attendance, AttendanceLeave, AttendanceProof, AttendanceRegularizationRequest, DashboardData, RoleId } from "./types";
import { clearAuthTokens, demoCredentials, fallbackData, isDemoMode, readAccessToken, readRefreshToken, saveAuthTokens } from "./data";

type DemoState = DashboardData & {
  attendanceLeaves: AttendanceLeave[];
  attendanceRegularizationRequests: AttendanceRegularizationRequest[];
  profiles: Record<string, { phone: string; image: string | null }>;
};

const demoDataKey = "buildtrack-demo-data";
const demoState: DemoState = {
  ...JSON.parse(JSON.stringify(fallbackData)) as DashboardData,
  attendanceLeaves: [],
  attendanceRegularizationRequests: [],
  profiles: {}
};

function restoreDemoData() {
  const saved = localStorage.getItem(demoDataKey);
  if (!saved) return;
  try {
    const parsed: unknown = JSON.parse(saved);
    if (!parsed || typeof parsed !== "object") throw new Error("Saved demo workspace has an invalid format.");
    const value = parsed as Partial<DemoState>;
    for (const key of ["projects", "quotes", "expenses", "siteVisits", "activities", "materials", "materialRequests", "attendance", "feedback", "backups", "people", "attendanceLeaves", "attendanceRegularizationRequests"] as const) {
      if (value[key] !== undefined && !Array.isArray(value[key])) throw new Error(`Saved demo workspace field '${key}' is invalid.`);
    }
    if (value.profiles && typeof value.profiles !== "object") throw new Error("Saved demo profile data is invalid.");
    Object.assign(demoState, value);
    demoState.attendance = Array.from(new Map(demoState.attendance.map((record) => [record.id, record])).values());
    const savedActivityIds = new Set(demoState.activities.map((activity) => activity.id));
    demoState.activities.push(...fallbackData.activities.filter((activity) =>
      activity.id.startsWith("DEMO-PROGRESS-") && !savedActivityIds.has(activity.id)
    ));
  } catch (error) {
    console.error("Unable to restore the local demo workspace:", error);
    localStorage.removeItem(demoDataKey);
  }
}

restoreDemoData();

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function saveResponse(body: unknown, status = 200): Response {
  localStorage.setItem(demoDataKey, JSON.stringify(demoState));
  return response(body, status);
}

function nextId(prefix: string, records: Array<{ id: string }>): string {
  const highest = records.reduce((max, record) => {
    const number = Number(record.id.replace(prefix, ""));
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(prefix === "PRJ-" || prefix === "USR-" ? 3 : 0, "0")}`;
}

function readBody(init?: RequestInit): Record<string, unknown> {
  if (typeof init?.body !== "string" || !init.body) return {};
  const value: unknown = JSON.parse(init.body);
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readDemoAttendanceProof(value: unknown): AttendanceProof | null {
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

function readDemoSiteVisitProof(value: unknown): { image: string; capturedAt: string } | null {
  if (!value || typeof value !== "object") return null;
  const proof = value as Record<string, unknown>;
  if (typeof proof.image !== "string" ||
    !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(proof.image) ||
    proof.image.length > 2_500_000 ||
    typeof proof.capturedAt !== "string" ||
    !Number.isFinite(Date.parse(proof.capturedAt))) return null;
  return { image: proof.image, capturedAt: new Date(proof.capturedAt).toISOString() };
}

function demoProfile(role: RoleId, email: string) {
  const credential = demoCredentials[role];
  if (email.toLowerCase() !== credential.email) return undefined;
  const name = role === "owner" ? "John Smith" : role === "employee" ? "Arjun Mehta" : "Ananya Rao";
  const stored = demoState.profiles[email.toLowerCase()];
  return {
    id: role === "owner" ? "owner" : demoState.people.find((person) => person.email.toLowerCase() === email.toLowerCase())?.id ?? role,
    name,
    email: credential.email,
    role: role === "owner" ? "Owner" : role === "employee" ? "Site Engineer" : "Client",
    phone: stored?.phone ?? "",
    image: stored?.image ?? null
  };
}

async function localDemoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  restoreDemoData();
  const rawUrl = typeof input === "string" ? input : input instanceof Request ? input.url : input.toString();
  const url = new URL(rawUrl, window.location.origin);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = (init?.method ?? "GET").toUpperCase();
  const body = readBody(init);
  const role = body.role;

  if (path === "/api/auth/login" && method === "POST") {
    if (role !== "owner" && role !== "employee" && role !== "client") return response({ error: "Choose a valid account role." }, 400);
    const credential = demoCredentials[role];
    if (text(body.email).toLowerCase() !== credential.email || body.password !== credential.password) {
      return response({ error: "Email or password is incorrect for this role." }, 401);
    }
    const profile = demoProfile(role, credential.email);
    return response({ user: { name: profile?.name ?? credential.label, email: credential.email, role } });
  }
  if (path === "/api/auth/logout" && method === "POST") return response({ status: "ok" });
  if (path === "/api/push/config") return response({ enabled: false, publicKey: null });
  if (path.startsWith("/api/push/subscriptions")) return response({ enabled: false });
  if (path === "/api/dashboard") return response(demoState);
  if (path === "/api/events") return response({ error: "Live updates are disabled in demo mode." }, 503);

  if (path === "/api/attendance/regularization-requests") {
    if (method === "GET") {
      const engineer = url.searchParams.get("engineer");
      return response(demoState.attendanceRegularizationRequests.filter((request) => !engineer || request.engineer === engineer));
    }
    if (method === "POST") {
      const attendanceId = text(body.attendanceId);
      const engineer = text(body.engineer);
      const capturedAt = text(body.capturedAt);
      const reason = text(body.reason).trim();
      const record = demoState.attendance.find((item) => item.id === attendanceId && item.engineer === engineer);
      if (!record || !record.date || !record.checkIn || record.checkOut || record.checkoutRegularization || !reason ||
        !Number.isFinite(Date.parse(capturedAt))) {
        return response({ error: "A valid attendance record, engineer, check-out time, and reason are required." }, 400);
      }
      const checkInTime = Date.parse(record.checkIn.capturedAt);
      const checkOutTime = Date.parse(capturedAt);
      if (Date.now() < checkInTime + 24 * 60 * 60 * 1000) {
        return response({ error: "A regularization request is available after the check-out deadline has passed." }, 409);
      }
      if (checkOutTime <= checkInTime || checkOutTime > checkInTime + 24 * 60 * 60 * 1000 || checkOutTime > Date.now()) {
        return response({ error: "Enter a past check-out time within 24 hours of check-in." }, 400);
      }
      if (demoState.attendanceRegularizationRequests.some((request) => request.attendanceId === record.id && request.status === "Pending review")) {
        return response({ error: "A regularization request for this attendance is already pending review." }, 409);
      }
      const request: AttendanceRegularizationRequest = {
        id: nextId("AREQ-", demoState.attendanceRegularizationRequests),
        attendanceId: record.id,
        engineer,
        date: record.date,
        capturedAt: new Date(checkOutTime).toISOString(),
        reason,
        requestedAt: new Date().toISOString(),
        status: "Pending review"
      };
      demoState.attendanceRegularizationRequests.unshift(request);
      return saveResponse({ request }, 201);
    }
  }
  const regularizationRequestMatch = path.match(/^\/api\/attendance\/regularization-requests\/([^/]+)$/);
  if (regularizationRequestMatch && method === "PATCH") {
    const request = demoState.attendanceRegularizationRequests.find((item) => item.id === regularizationRequestMatch[1]);
    if (!request) return response({ error: "Attendance regularization request was not found." }, 404);
    if (request.status !== "Pending review") return response({ error: "This request has already been reviewed." }, 409);
    const reviewedBy = text(body.reviewedBy).trim();
    if ((body.decision !== "Approved" && body.decision !== "Declined") || !reviewedBy) {
      return response({ error: "Choose an approval decision and provide the reviewing owner." }, 400);
    }
    let updatedRecord: Attendance | undefined;
    if (body.decision === "Approved") {
      const record = demoState.attendance.find((item) => item.id === request.attendanceId);
      if (!record || !record.checkIn || record.checkOut || record.checkoutRegularization ||
        Date.parse(request.capturedAt) <= Date.parse(record.checkIn.capturedAt) ||
        Date.parse(request.capturedAt) > Date.parse(record.checkIn.capturedAt) + 24 * 60 * 60 * 1000) {
        return response({ error: "This attendance can no longer be regularized." }, 409);
      }
      record.checkoutRegularization = {
        capturedAt: request.capturedAt,
        reason: `Engineer request: ${request.reason}`,
        regularizedBy: reviewedBy,
        regularizedAt: new Date().toISOString()
      };
      record.status = "Present";
      record.evidence = "Check-in photo; check-out regularized by owner";
      updatedRecord = record;
    }
    request.status = body.decision;
    request.reviewedBy = reviewedBy;
    request.reviewedAt = new Date().toISOString();
    return saveResponse({ request, ...(updatedRecord ? { record: updatedRecord } : {}) });
  }

  if (path === "/api/attendance/leaves") {
    if (method === "GET") return response(demoState.attendanceLeaves);
    if (method === "POST") {
      const title = text(body.title).trim();
      const date = text(body.date);
      if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return response({ error: "A leave name and valid calendar date are required." }, 400);
      if (demoState.attendanceLeaves.some((leave) => leave.date === date)) return response({ error: "A leave is already scheduled for this date." }, 409);
      const record = { id: nextId("LEV-", demoState.attendanceLeaves), title, date };
      demoState.attendanceLeaves.push(record);
      return saveResponse({ record }, 201);
    }
  }
  const leaveMatch = path.match(/^\/api\/attendance\/leaves\/([^/]+)$/);
  if (leaveMatch && method === "DELETE") {
    const index = demoState.attendanceLeaves.findIndex((leave) => leave.id === leaveMatch[1]);
    if (index < 0) return response({ error: "Leave was not found." }, 404);
    const [record] = demoState.attendanceLeaves.splice(index, 1);
    return saveResponse({ record });
  }

  if (path === "/api/profiles/me") {
    const profileRole = url.searchParams.get("role");
    const email = url.searchParams.get("email") ?? "";
    if (profileRole !== "owner" && profileRole !== "employee" && profileRole !== "client") return response({ error: "Profile not found." }, 404);
    const profile = demoProfile(profileRole, email);
    if (!profile) return response({ error: "Profile not found." }, 404);
    if (method === "GET") return response({ profile, qrCode: null });
    if (method === "PATCH") {
      const previous = demoState.profiles[email.toLowerCase()] ?? { phone: "", image: null };
      const updated = {
        phone: body.phone === undefined ? previous.phone : text(body.phone),
        image: body.image === undefined ? previous.image : typeof body.image === "string" ? body.image : null
      };
      demoState.profiles[email.toLowerCase()] = updated;
      return saveResponse({ profile: { ...profile, ...updated }, qrCode: null });
    }
  }
  const publicProfileMatch = path.match(/^\/api\/profiles\/([^/]+)$/);
  if (publicProfileMatch && method === "GET") {
    const profile = publicProfileMatch[1] === "owner"
      ? demoProfile("owner", demoCredentials.owner.email)
      : demoState.people.find((person) => person.id === publicProfileMatch[1]);
    return profile ? response({ profile, qrCode: null }) : response({ error: "This public profile is not available." }, 404);
  }

  if (path.startsWith("/api/reports/") && method === "GET") return response(demoState);
  const backupDownload = path.match(/^\/api\/backups\/([^/]+)\/download$/);
  if (backupDownload && method === "GET") return response({ ...demoState, id: backupDownload[1] });

  const collectionRoutes: Record<string, keyof DashboardData> = {
    "/api/projects": "projects",
    "/api/quotations": "quotes",
    "/api/expenses": "expenses",
    "/api/site-visits": "siteVisits",
    "/api/materials": "materials",
    "/api/material-requests": "materialRequests",
    "/api/attendance": "attendance",
    "/api/progress": "activities",
    "/api/feedback": "feedback",
    "/api/backups": "backups",
    "/api/people": "people"
  };
  if (collectionRoutes[path] && method === "GET") {
    const key = collectionRoutes[path];
    const records = demoState[key];
    return response(key === "activities" ? demoState.activities.filter((item) => item.kind === "progress") : records);
  }

  if (method === "POST" && collectionRoutes[path]) {
    const collection = collectionRoutes[path];
    const date = new Date().toLocaleDateString("en", { day: "2-digit", month: "short", year: "numeric" });
    const projectName = text(body.project);
    const project = demoState.projects.find((item) => item.name === projectName);
    let record: Record<string, unknown>;
    if (collection === "projects") {
      record = { id: nextId("PRJ-", demoState.projects), name: text(body.name), site: text(body.site), client: text(body.client, "Unassigned"), engineer: text(body.engineer, "Unassigned"), status: "Planning", progress: 0, dueDate: text(body.dueDate, "To be confirmed"), image: "photo-1600585154340-be6161a56a0c" };
    } else if (collection === "quotes") {
      record = { id: nextId("QT-", demoState.quotes), project: projectName, title: text(body.title), client: project?.client ?? "Unassigned", amount: Number(body.amount) || 0, date, status: "Awaiting review", attachment: body.quotationAttachment };
    } else if (collection === "expenses") {
      record = { id: nextId("EXP-", demoState.expenses), project: projectName, category: "Other", description: text(body.description), amount: Number(body.amount) || 0, date, submittedBy: text(body.submittedBy), status: body.entryType === "log" ? "Logged" : "Pending review", attachment: body.attachment };
    } else if (collection === "siteVisits") {
      const engineer = text(body.engineer);
      const visitDate = text(body.date);
      const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(visitDate) ? new Date(`${visitDate}T00:00:00.000Z`) : null;
      if (!project || !/^\d{4}-\d{2}-\d{2}$/.test(visitDate) ||
        !parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== visitDate ||
        !engineer || !demoState.people.some((person) => person.role === "Site Engineer" && person.name === engineer) && project.engineer !== engineer) {
        return response({ error: "A valid project, assigned engineer, and visit date are required." }, 400);
      }
      record = { id: nextId("VIS-", demoState.siteVisits), project: projectName, site: project.site, engineer, date: visitDate, purpose: text(body.description), status: "Scheduled" };
    } else if (collection === "activities") {
      record = { id: nextId("UPD-", demoState.activities), actor: text(body.submittedBy), action: "shared a progress update", project: projectName, description: text(body.description), time: "Just now", kind: "progress", stage: body.stage, attachment: body.attachment, attachments: body.attachments, createdAt: new Date().toISOString() };
      if (project && typeof body.progress === "number") project.progress = body.progress;
    } else if (collection === "materials") {
      record = { id: nextId("MAT-", demoState.materials), material: text(body.material), project: projectName, received: text(body.received), used: text(body.used, "0"), stock: text(body.stock, text(body.received)), lastUpdated: "Just now", submittedBy: text(body.submittedBy) };
    } else if (collection === "materialRequests") {
      record = { id: nextId("MREQ-", demoState.materialRequests), material: text(body.material), project: projectName, quantity: text(body.quantity), requestedBy: text(body.requestedBy, text(body.submittedBy)), note: text(body.note), requestedAt: date, status: "Pending review" };
    } else if (collection === "people") {
      record = { id: nextId("USR-", demoState.people), name: text(body.name), email: text(body.email), phone: text(body.phone), role: body.role === "Client" ? "Client" : "Site Engineer", project: text(body.project, "No assigned sites") };
    } else if (collection === "feedback") {
      record = { id: nextId("FDB-", demoState.feedback), project: projectName, client: text(body.client), rating: Number(body.rating) || 5, comment: text(body.comment), date };
    } else if (collection === "backups") {
      record = { id: nextId("BKP-", demoState.backups), status: "Ready to download", requestedAt: date, requestedBy: "John Smith" };
    } else {
      const engineer = text(body.engineer);
      const attendanceDate = text(body.date);
      const proof = readDemoAttendanceProof(body.proof);
      if (!engineer || !/^\d{4}-\d{2}-\d{2}$/.test(attendanceDate) ||
        (body.action !== "check-in" && body.action !== "check-out") || !proof) {
        return response({ error: "Engineer, date, action, photo, and location are required." }, 400);
      }
      let existing = demoState.attendance.find((item) => item.engineer === engineer && item.date === attendanceDate);
      if (body.action === "check-in" && existing?.checkIn) {
        return response({ error: "A check-in is already recorded for today." }, 409);
      }
      if (body.action === "check-out" && (!existing?.checkIn || existing.checkOut || existing.checkoutRegularization)) {
        return response({ error: "Check in before recording a check-out." }, 409);
      }
      if (!existing) {
        existing = { id: nextId("ATT-", demoState.attendance), engineer, date: attendanceDate, present: "—", shift: "Full day", status: "Checked in", evidence: "Check-in photo" };
        demoState.attendance.unshift(existing);
      }
      if (body.action === "check-in") {
        existing.checkIn = proof;
        existing.status = "Checked in";
      } else {
        existing.checkOut = proof;
        existing.status = "Present";
      }
      record = existing;
    }
    if (collection !== "attendance") {
      (demoState[collection] as unknown as Record<string, unknown>[]).unshift(record);
    }
    return saveResponse({ record }, 201);
  }

  const updateMatch = path.match(/^\/api\/(quotations|expenses)\/([^/]+)$/);
  const siteVisitMatch = path.match(/^\/api\/site-visits\/([^/]+)$/);
  if (siteVisitMatch && method === "PATCH") {
    const visit = demoState.siteVisits.find((item) => item.id === siteVisitMatch[1]);
    if (!visit) return response({ error: "Site visit not found." }, 404);
    if (!text(body.engineer) || text(body.engineer) !== visit.engineer) return response({ error: "This site visit is assigned to another engineer." }, 403);
    const proof = readDemoSiteVisitProof(body.proof);
    if (!proof) return response({ error: "A valid site photo and capture time are required." }, 400);
    if (body.action === "check-in") {
      if (visit.status !== "Scheduled") return response({ error: "This visit is no longer scheduled for check-in." }, 409);
      visit.checkIn = proof;
      visit.status = "Checked in";
    } else if (body.action === "check-out") {
      if (visit.status !== "Checked in" || !visit.checkIn) return response({ error: "Check in with a photo before checking out." }, 409);
      if (Date.parse(proof.capturedAt) <= Date.parse(visit.checkIn.capturedAt)) return response({ error: "The check-out photo must be captured after check-in." }, 400);
      visit.checkOut = proof;
      visit.status = "Completed";
    } else {
      return response({ error: "Choose check-in or check-out for this site visit." }, 400);
    }
    return saveResponse({ record: visit });
  }
  if (updateMatch && method === "PATCH") {
    const key = updateMatch[1] === "quotations" ? "quotes" : "expenses";
    const records = demoState[key] as Array<{ id: string; status: string }>;
    const record = records.find((item) => item.id === updateMatch[2]);
    if (!record) return response({ error: "Record not found." }, 404);
    record.status = text(body.status, record.status);
    return saveResponse({ record });
  }
  const regularizeMatch = path.match(/^\/api\/attendance\/([^/]+)\/regularize$/);
  if (regularizeMatch && method === "PATCH") {
    const record = demoState.attendance.find((item) => item.id === regularizeMatch[1]);
    if (!record) return response({ error: "Attendance record was not found." }, 404);
    record.checkoutRegularization = { capturedAt: text(body.capturedAt), reason: text(body.reason), regularizedBy: text(body.regularizedBy), regularizedAt: new Date().toISOString() };
    record.status = "Present";
    return saveResponse({ record });
  }
  const personMatch = path.match(/^\/api\/people\/([^/]+)$/);
  if (personMatch && method === "PATCH") {
    const person = demoState.people.find((item) => item.id === personMatch[1]);
    if (!person) return response({ error: "Person not found." }, 404);
    const name = text(body.name).trim();
    const email = text(body.email).trim();
    const phone = text(body.phone).trim();
    const phoneDigits = phone.replace(/\D/g, "");
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      (phone && (!/^\+?[\d\s().-]+$/.test(phone) || phoneDigits.length < 7 || phoneDigits.length > 15))) {
      return response({ error: "Enter a valid name, email, and phone number." }, 400);
    }
    if (demoState.people.some((item) => item.id !== person.id && item.email.toLowerCase() === email.toLowerCase())) {
      return response({ error: "A person with this email already exists." }, 409);
    }
    const previousName = person.name;
    person.name = name;
    person.email = email;
    person.phone = phone;
    if (person.role === "Client") {
      demoState.projects.forEach((project) => { if (project.client === previousName) project.client = name; });
      demoState.quotes.forEach((quote) => { if (quote.client === previousName) quote.client = name; });
      demoState.feedback.forEach((item) => { if (item.client === previousName) item.client = name; });
    } else {
      demoState.projects.forEach((project) => { if (project.engineer === previousName) project.engineer = name; });
      demoState.siteVisits.forEach((visit) => { if (visit.engineer === previousName) visit.engineer = name; });
      demoState.activities.forEach((activity) => { if (activity.actor === previousName) activity.actor = name; });
      demoState.expenses.forEach((expense) => { if (expense.submittedBy === previousName) expense.submittedBy = name; });
      demoState.attendance.forEach((record) => { if (record.engineer === previousName) record.engineer = name; });
      demoState.materials.forEach((material) => { if (material.submittedBy === previousName) material.submittedBy = name; });
      demoState.materialRequests.forEach((request) => { if (request.requestedBy === previousName) request.requestedBy = name; });
    }
    return saveResponse({ record: person });
  }
  if (personMatch && method === "DELETE") {
    const index = demoState.people.findIndex((person) => person.id === personMatch[1]);
    if (index < 0) return response({ error: "Person not found." }, 404);
    const [record] = demoState.people.splice(index, 1);
    return saveResponse({ record });
  }

  return response({ error: `Demo mode does not support ${method} ${path}.` }, 404);
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  const refreshToken = readRefreshToken();
  if (!refreshToken) return null;
  refreshInFlight = (async () => {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken })
    });
    if (response.status === 401) {
      clearAuthTokens();
      localStorage.removeItem("buildtrack-session");
      return null;
    }
    if (!response.ok) throw new Error(`Session refresh failed (${response.status}).`);
    const result = await response.json() as { accessToken?: string; refreshToken?: string };
    if (!result.accessToken || !result.refreshToken) throw new Error("Session refresh response did not include both tokens.");
    saveAuthTokens(result.accessToken, result.refreshToken);
    return result.accessToken;
  })();
  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (isDemoMode()) return localDemoFetch(input, init);

  const baseRequest = input instanceof Request ? input.clone() : null;
  const originalHeaders = init?.headers ?? baseRequest?.headers;
  const fetchWithToken = (token: string | null) => {
    const headers = new Headers(originalHeaders);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const requestInit = { ...init, headers };
    return baseRequest
      ? fetch(new Request(baseRequest.clone(), requestInit))
      : fetch(input, requestInit);
  };
  const url = new URL(baseRequest?.url ?? input.toString(), window.location.href);
  const isAuthEndpoint = url.pathname.startsWith("/api/auth/");
  const accessToken = readAccessToken();
  const response = await fetchWithToken(accessToken);
  if (response.status !== 401 || isAuthEndpoint) return response;

  const currentToken = readAccessToken();
  if (currentToken && currentToken !== accessToken) return fetchWithToken(currentToken);
  const renewedToken = await refreshAccessToken();
  return renewedToken ? fetchWithToken(renewedToken) : response;
}
