import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import type { Attendance, AttendanceLeaveRequest, AttendanceProof, AttendanceRegularizationRequest, Backup, DashboardData, Expense, Feedback, Material, Person, Project, Quote, RecordModalType, Role, RoleId, SiteVisit, SiteVisitProof, Activity, NotificationItem } from "./types";
import { clearAuthTokens, emptyDashboardData, navigation, pageFromPath, pagePath, readRefreshToken, readSession, roleId, roleName, rolePath } from "./data";
import { apiFetch } from "./api";
import { formatCurrency, googleReviewUrl, initials, siteVisitDateParts } from "./utils";
import { BuildingIcon, RecordModal } from "./components";
import OwnerDashboard from "../owner/dashboard/page";
import EngineerDashboard from "../engineer/dashboard/page";
import ClientDashboard from "../client/dashboard/page";
import { FeaturePage } from "./feature-page";
import OwnerProjectsPage from "../owner/projects/page";
import OwnerMaterialsPage from "../owner/material/page";
import OwnerFinancialReport from "../owner/dashboard/financial-report";
import { NotFoundPage } from "./legal-pages";
import { AccountProfilePage } from "./profile-page";
import type { SiteVisitAction } from "./site-visits-page";

type PushStatus = "checking" | "ready" | "enabled" | "unsupported" | "unconfigured" | "denied" | "error";

function decodeVapidPublicKey(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
  const buffer = new ArrayBuffer(raw.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return buffer;
}

export function PortalRoute({ role }: { role: RoleId }) {
  const session = readSession();
  const location = useLocation();
  if (!session) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  }
  if (session.role !== role) {
    return <Navigate to={rolePath(session.role)} replace />;
  }
  if (location.pathname.slice(rolePath(role).length).replace(/^\/+|\/+$/g, "") && pageFromPath(location.pathname, roleName(role)) === "Dashboard") {
    return <NotFoundPage />;
  }
  return <PortalApp role={roleName(role)} userName={session.name} userEmail={session.email} />;
}

export function PortalApp({ role, userName, userEmail }: { role: Role; userName: string; userEmail: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState<DashboardData>(emptyDashboardData);
  const page = pageFromPath(location.pathname, role);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState<RecordModalType | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [attendanceReviewNotifications, setAttendanceReviewNotifications] = useState<NotificationItem[]>([]);
  const [attendanceReviewVersion, setAttendanceReviewVersion] = useState(0);
  const [pushStatus, setPushStatus] = useState<PushStatus>("checking");
  const [pushPublicKey, setPushPublicKey] = useState<string | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const navigateToPage = (nextPage: string) => navigate(pagePath(role, nextPage));

  useEffect(() => {
    if (role === "Client") return;
    let active = true;
    const loadProfileImage = async () => {
      try {
        const response = await apiFetch(`/api/profiles/me?role=${encodeURIComponent(roleId(role))}&email=${encodeURIComponent(userEmail)}`);
        const result = await response.json() as { profile?: { image?: string | null }; error?: string };
        if (!response.ok || !result.profile) throw new Error(result.error || `Profile request failed (${response.status})`);
        if (active) setProfileImage(result.profile.image ?? null);
      } catch (error) {
        console.error("Unable to load the profile photo:", error);
      }
    };
    void loadProfileImage();
    return () => { active = false; };
  }, [role, userEmail]);

  useEffect(() => {
    let active = true;
    const checkPushSubscription = async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setPushStatus("unsupported");
        return;
      }
      try {
        const response = await apiFetch("/api/push/config");
        if (!response.ok) throw new Error(`Push configuration request failed (${response.status})`);
        const config = await response.json() as { enabled?: boolean; publicKey?: string | null };
        if (!config.enabled || !config.publicKey) {
          if (active) setPushStatus("unconfigured");
          return;
        }
        if (active) setPushPublicKey(config.publicKey);
        if (Notification.permission === "denied") {
          if (active) setPushStatus("denied");
          return;
        }
        const registration = await navigator.serviceWorker.register("/service-worker.js", { updateViaCache: "none" });
        await registration.update();
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription && Notification.permission === "granted") {
          const saveResponse = await apiFetch("/api/push/subscriptions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscription: subscription.toJSON(), role: roleId(role), userName, userEmail })
          });
          if (!saveResponse.ok) throw new Error(`Push subscription sync failed (${saveResponse.status})`);
          if (active) setPushStatus("enabled");
        } else if (active) {
          setPushStatus("ready");
        }
      } catch (error) {
        console.error("Unable to initialize browser push notifications:", error);
        if (active) setPushStatus("error");
      }
    };
    void checkPushSubscription();
    return () => { active = false; };
  }, [role, userName]);

  const togglePushNotifications = async () => {
    if (pushStatus === "enabled") {
      try {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
          const response = await apiFetch("/api/push/subscriptions", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: subscription.endpoint })
          });
          if (!response.ok) throw new Error(`Push unsubscribe request failed (${response.status})`);
          await subscription.unsubscribe();
        }
        setPushStatus("ready");
      } catch (error) {
        console.error("Unable to disable browser push notifications:", error);
        setPushStatus("error");
        showToast(error instanceof Error ? error.message : "Could not disable browser notifications.");
      }
      return;
    }
    if (!pushPublicKey) return;
    try {
      setPushStatus("checking");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushStatus(permission === "denied" ? "denied" : "ready");
        return;
      }
      const registration = await navigator.serviceWorker.register("/service-worker.js", { updateViaCache: "none" });
      await registration.update();
      const subscription = await registration.pushManager.getSubscription() ??
        await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidPublicKey(pushPublicKey)
        });
      const response = await apiFetch("/api/push/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON(), role: roleId(role), userName })
      });
      if (!response.ok) {
        const result = await response.json() as { error?: string };
        throw new Error(result.error || `Push subscription failed (${response.status})`);
      }
      setPushStatus("enabled");
      showToast("Browser push notifications are enabled.");
    } catch (error) {
      console.error("Unable to enable browser push notifications:", error);
      setPushStatus("error");
      showToast(error instanceof Error ? error.message : "Could not enable browser notifications.");
    }
  };

  useEffect(() => {
    if (page !== "Dashboard") return;
    let active = true;
    const load = async () => {
      try {
        const response = await apiFetch("/api/dashboard");
        if (!response.ok) throw new Error(`Dashboard request failed (${response.status})`);
        const result: DashboardData = await response.json();
        if (active) {
          setData(result);
        }
      } catch (error) {
        console.error("Unable to load workspace data from the SQLite API:", error);
      }
    };
    void load();
    return () => { active = false; };
  }, [page]);

  useEffect(() => {
    if (role !== "Employee") {
      setAttendanceReviewNotifications([]);
      return;
    }
    let active = true;
    const loadAttendanceReviewNotifications = async () => {
      try {
        const query = `?engineer=${encodeURIComponent(userName)}`;
        const [leaveResponse, regularizationResponse] = await Promise.all([
          apiFetch(`/api/attendance/leave-requests${query}`),
          apiFetch(`/api/attendance/regularization-requests${query}`)
        ]);
        if (!leaveResponse.ok || !regularizationResponse.ok) {
          throw new Error(`Attendance notification refresh failed (${leaveResponse.status}/${regularizationResponse.status}).`);
        }
        const [leaveResult, regularizationResult] = await Promise.all([
          leaveResponse.json() as Promise<AttendanceLeaveRequest[]>,
          regularizationResponse.json() as Promise<AttendanceRegularizationRequest[]>
        ]);
        if (!Array.isArray(leaveResult) || !Array.isArray(regularizationResult)) {
          throw new Error("Attendance notification refresh returned invalid data.");
        }
        if (!active) return;
        const reviewedLeaves = leaveResult.filter((request) => request.status !== "Pending review").map((request) => ({
          title: `Leave request ${request.status.toLowerCase()}`,
          detail: `${new Date(`${request.date}T00:00:00`).toLocaleDateString()} · ${request.reason}`,
          time: request.reviewedAt ?? request.requestedAt,
          icon: "◷",
          page: "Attendance"
        }));
        const reviewedRegularizations = regularizationResult.filter((request) => request.status !== "Pending review").map((request) => ({
          title: `Attendance request ${request.status.toLowerCase()}`,
          detail: `${new Date(`${request.date}T00:00:00`).toLocaleDateString()} · ${request.reason}`,
          time: request.reviewedAt ?? request.requestedAt,
          icon: "◷",
          page: "Attendance"
        }));
        setAttendanceReviewNotifications(
          [...reviewedLeaves, ...reviewedRegularizations].sort((left, right) => Date.parse(right.time) - Date.parse(left.time)).slice(0, 8)
        );
      } catch (error) {
        console.error("Unable to load engineer attendance review notifications:", error);
      }
    };
    void loadAttendanceReviewNotifications();
    return () => { active = false; };
  }, [attendanceReviewVersion, data.attendance, role, userName]);

  useEffect(() => {
    const events = new EventSource("/api/events");
    events.onmessage = (event) => {
      let update: {
        resource?: unknown;
        visit?: SiteVisit;
        action?: unknown;
        push?: { body: string; targets: Array<{ role: string; userName?: string }> };
      };
      try {
        update = JSON.parse(event.data) as typeof update;
      } catch (error) {
        console.error("Unable to parse a real-time workspace update:", error);
        return;
      }
      if (update.resource === "siteVisits") {
        const visit = update.visit;
        if (!visit || role === "Client" || (role === "Employee" && visit.engineer !== userName)) return;
        void (async () => {
          try {
            const response = await apiFetch("/api/site-visits");
            if (!response.ok) throw new Error(`Site visit refresh failed (${response.status})`);
            const visits: unknown = await response.json();
            if (!Array.isArray(visits)) throw new Error("Site visit refresh returned invalid data.");
            setData((current) => ({ ...current, siteVisits: visits as DashboardData["siteVisits"] }));
            if (role === "Employee" && update.action === "scheduled") {
              showToast(`New site visit scheduled for ${visit.project} on ${visit.date}.`);
            }
          } catch (error) {
            console.error("Unable to refresh site visits after a real-time update:", error);
          }
        })();
        return;
      }
      if (role === "Employee") {
        if (update.resource === "attendance") {
          if (update.push?.targets.some((target) => target.role === "employee" && target.userName === userName)) {
            showToast(update.push.body);
          }
          setAttendanceReviewVersion((current) => current + 1);
          void (async () => {
            try {
              const response = await apiFetch("/api/attendance");
              if (!response.ok) throw new Error(`Attendance refresh failed (${response.status})`);
              const records: unknown = await response.json();
              if (!Array.isArray(records)) throw new Error("Attendance refresh returned invalid data.");
              setData((current) => ({ ...current, attendance: records as DashboardData["attendance"] }));
            } catch (error) {
              console.error("Unable to refresh attendance after a real-time update:", error);
            }
          })();
        }
        return;
      }
      const resource = update.resource;
      if (resource !== "materials" && resource !== "materialRequests" && resource !== "expenses" && resource !== "progress" && resource !== "quotations" && resource !== "attendance") {
        console.error("Received an unsupported real-time workspace update:", resource);
        return;
      }
      if (role === "Client" && resource !== "progress" && resource !== "quotations") return;
      void (async () => {
        try {
          if (resource === "progress") {
            const [response, projectsResponse] = await Promise.all([apiFetch("/api/progress"), apiFetch("/api/projects")]);
            if (!response.ok) throw new Error(`Progress refresh failed (${response.status})`);
            if (!projectsResponse.ok) throw new Error(`Project refresh failed (${projectsResponse.status})`);
            const activities = await response.json() as DashboardData["activities"];
            const projects = await projectsResponse.json() as DashboardData["projects"];
            if (!Array.isArray(activities)) throw new Error("Progress refresh returned invalid data.");
            if (!Array.isArray(projects)) throw new Error("Project refresh returned invalid data.");
            const clientProjectNames = data.projects.filter((project) => project.client === userName).map((project) => project.name);
            const assignedClientProject = data.people.find((person) => person.role === "Client" && person.name === userName)?.project;
            const visibleActivities = role === "Client"
              ? activities.filter((activity) => clientProjectNames.includes(activity.project) || activity.project === assignedClientProject)
              : activities;
            setData((current) => ({ ...current, activities: visibleActivities, projects }));
            return;
          }
          const endpoint = resource === "materialRequests" ? "/api/material-requests" : `/api/${resource}`;
          const response = await apiFetch(endpoint);
          if (!response.ok) throw new Error(`${resource} refresh failed (${response.status})`);
          const records: unknown = await response.json();
          if (!Array.isArray(records)) throw new Error(`${resource} refresh returned invalid data.`);
          if (resource === "materials") {
            setData((current) => ({ ...current, materials: records as DashboardData["materials"] }));
          } else if (resource === "materialRequests") {
            setData((current) => ({ ...current, materialRequests: records as DashboardData["materialRequests"] }));
          } else if (resource === "quotations") {
            setData((current) => ({ ...current, quotes: records as DashboardData["quotes"] }));
          } else if (resource === "attendance") {
            setData((current) => ({ ...current, attendance: records as DashboardData["attendance"] }));
          } else {
            setData((current) => ({ ...current, expenses: records as DashboardData["expenses"] }));
          }
        } catch (error) {
          console.error(`Unable to refresh ${resource} after a real-time update:`, error);
        }
      })();
    };
    events.onerror = () => {
      console.error("Real-time workspace connection interrupted; the browser will retry automatically.");
    };
    return () => events.close();
  }, [data.people, data.projects, role, userName]);

  useEffect(() => {
    if (role !== "Client" || page !== "My Projects") return;
    let active = true;
    const loadClientProgress = async () => {
      try {
        const response = await apiFetch("/api/progress");
        if (!response.ok) throw new Error(`Project progress request failed (${response.status})`);
        const activities = await response.json() as DashboardData["activities"];
        if (!Array.isArray(activities)) throw new Error("Project progress request returned invalid data.");
        const clientProjectNames = data.projects.filter((project) => project.client === userName).map((project) => project.name);
        const assignedClientProject = data.people.find((person) => person.role === "Client" && person.name === userName)?.project;
        const visibleActivities = activities.filter((activity) => clientProjectNames.includes(activity.project) || activity.project === assignedClientProject);
        if (active) setData((current) => ({ ...current, activities: visibleActivities }));
      } catch (error) {
        console.error("Unable to load progress photos for the client project report:", error);
      }
    };
    void loadClientProgress();
    return () => { active = false; };
  }, [data.people, data.projects, page, role, userName]);

  useEffect(() => {
    if (page !== "Materials") return;
    let active = true;
    const loadMaterialRequests = async () => {
      try {
        const response = await apiFetch("/api/material-requests");
        if (!response.ok) throw new Error(`Material request list failed (${response.status})`);
        const requests: DashboardData["materialRequests"] = await response.json();
        if (!Array.isArray(requests)) throw new Error("Material request list returned invalid data.");
        if (active) setData((current) => ({ ...current, materialRequests: requests }));
      } catch (error) {
        console.error("Unable to load material requests:", error);
      }
    };
    void loadMaterialRequests();
    return () => { active = false; };
  }, [page]);

  useEffect(() => {
    const resources: Record<string, string> = {
      "Projects & Sites": "/api/projects",
      "My Sites": "/api/projects",
      "My Projects": "/api/projects",
      Materials: "/api/materials",
      Expenses: "/api/expenses",
      Quotations: "/api/quotations",
      Attendance: "/api/attendance",
      "Progress Updates": "/api/progress",
      "Work Progress": "/api/progress",
      Timeline: "/api/progress",
      "Site Visits": "/api/site-visits",
      Feedback: "/api/feedback",
      People: "/api/people",
      "Settings & Backup": "/api/backups"
    };
    const endpoint = resources[page];
    if (!endpoint) return;
    let active = true;
    const loadPageData = async () => {
      try {
        const response = await apiFetch(endpoint);
        if (!response.ok) throw new Error(`${page} request failed (${response.status})`);
        const result: unknown = await response.json();
        if (!active || !Array.isArray(result)) return;
        setData((current) => {
          switch (page) {
            case "Projects & Sites":
            case "My Sites":
            case "My Projects":
              return { ...current, projects: result as DashboardData["projects"] };
            case "Materials":
              return { ...current, materials: result as DashboardData["materials"] };
            case "Expenses":
              return { ...current, expenses: result as DashboardData["expenses"] };
            case "Quotations":
              return { ...current, quotes: result as DashboardData["quotes"] };
            case "Attendance":
              return { ...current, attendance: result as DashboardData["attendance"] };
            case "Progress Updates":
            case "Work Progress":
            case "Timeline":
              return { ...current, activities: [...result as DashboardData["activities"], ...current.activities.filter((item) => item.kind !== "progress")] };
            case "Site Visits":
              return { ...current, siteVisits: result as DashboardData["siteVisits"] };
            case "Feedback":
              return { ...current, feedback: result as DashboardData["feedback"] };
            case "People":
              return { ...current, people: result as DashboardData["people"] };
            case "Settings & Backup":
              return { ...current, backups: result as DashboardData["backups"] };
            default:
              return current;
          }
        });
      } catch (error) {
        console.error(`Unable to load ${page} API:`, error);
      }
    };
    void loadPageData();
    return () => { active = false; };
  }, [page]);

  const visibleProjects = useMemo(() => data.projects.filter((project) => {
    const matchesSearch = `${project.name} ${project.site} ${project.client}`.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "All" || project.status === filter;
    return matchesSearch && matchesFilter;
  }), [data.projects, filter, search]);

  const notifications = useMemo<NotificationItem[]>(() => {
    if (role === "Owner") {
      return [
        ...data.activities.filter((activity) => activity.kind === "progress").map((activity) => ({
          title: "Work update received",
          detail: `${activity.actor} · ${activity.project} · ${activity.description || activity.action}`,
          time: activity.time,
          icon: "▥",
          page: "Progress Updates"
        })),
        ...data.expenses.filter((expense) => expense.status.toLowerCase().includes("pending")).map((expense) => ({
          title: "Expense needs review",
          detail: `${expense.description} · ${formatCurrency(expense.amount)}`,
          time: expense.date,
          icon: "＄",
          page: "Expenses"
        })),
        ...data.materials.filter((material) => material.submittedBy && material.submittedBy !== userName).map((material) => ({
          title: "Material update from engineer",
          detail: `${material.material} · ${material.project} · ${material.submittedBy}`,
          time: material.lastUpdated,
          icon: "◈",
          page: "Materials"
        })),
        ...data.materialRequests.filter((request) => request.status === "Pending review").map((request) => ({
          title: "Material request needs review",
          detail: `${request.material} · ${request.quantity} · ${request.project} · ${request.requestedBy}`,
          time: request.requestedAt,
          icon: "◈",
          page: "Materials"
        })),
        ...data.quotes.filter((quote) => quote.status.toLowerCase().includes("review")).map((quote) => ({
          title: "Quotation needs review",
          detail: `${quote.title} · ${quote.project}`,
          time: quote.date,
          icon: "▤",
          page: "Quotations"
        })),
        ...data.quotes.filter((quote) => quote.status === "Approved").map((quote) => ({
          title: "Quotation approved by client",
          detail: `${quote.title} · ${quote.project}`,
          time: quote.date,
          icon: "▤",
          page: "Quotations"
        }))
      ].slice(0, 8);
    }
    if (role === "Employee") {
      return [
        ...data.siteVisits.filter((visit) => visit.status !== "Completed" && visit.status !== "Cancelled" && visit.engineer === userName).map((visit) => ({
          title: visit.status === "Checked in" ? "Site visit in progress" : "Upcoming site visit",
          detail: `${visit.project} · ${visit.site}`,
          time: siteVisitDateParts(visit.date).label,
          icon: "⌖",
          page: "Site Visits"
        })),
        ...data.activities.filter((activity) => activity.kind === "progress" && activity.actor === userName).map((activity) => ({
          title: "Site progress update",
          detail: `${activity.actor} · ${activity.project}`,
          time: activity.time,
          icon: "▥",
          page: "Progress Updates"
        })),
        ...attendanceReviewNotifications
      ].slice(0, 8);
    }
    const clientProjectNames = new Set([
      ...data.projects.filter((project) => project.client === userName).map((project) => project.name),
      ...data.people.filter((person) => person.role === "Client" && person.name === userName).map((person) => person.project)
    ]);
    return [
      ...data.activities.filter((activity) => clientProjectNames.has(activity.project)).map((activity) => ({
        title: activity.kind === "progress" ? "Work update from your project" : "Project update",
        detail: `${activity.actor} · ${activity.project} · ${activity.description || activity.action}`,
        time: activity.time,
        icon: activity.kind === "progress" ? "▥" : "◷",
        page: "Timeline"
      })),
      ...data.quotes.filter((quote) => (quote.client === userName || clientProjectNames.has(quote.project)) && (quote.status === "Sent to client" || quote.status === "Awaiting review" || quote.status === "Changes requested")).map((quote) => ({
        title: quote.status === "Sent to client" ? "Quotation ready for review" : "Quotation updated",
        detail: `${quote.title} · ${quote.project}`,
        time: quote.date,
        icon: "▤",
        page: "Quotations"
      })),
    ].slice(0, 8);
  }, [attendanceReviewNotifications, userName, data.activities, data.expenses, data.materialRequests, data.materials, data.people, data.projects, data.quotes, data.siteVisits, role]);

  useEffect(() => {
    if (!notificationsOpen) return;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotificationsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.documentElement.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [notificationsOpen]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  };

  const readFileDataUrl = (file: FormDataEntryValue | null) => {
    if (!(file instanceof File) || !file.size) return Promise.resolve(undefined);
    if (file.size > 1_800_000) return Promise.reject(new Error("The attachment must be smaller than 1.8 MB."));
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read the selected attachment."));
      reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read the selected attachment."));
      reader.readAsDataURL(file);
    });
  };

  const readFileDataUrls = async (entries: FormDataEntryValue[]) => {
    const files = entries.filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (files.length > 5) throw new Error("You can upload up to 5 progress photos.");
    if (files.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
      throw new Error("Progress photos must be JPEG, PNG, or WebP images.");
    }
    return Promise.all(files.map((file) => readFileDataUrl(file)));
  };

  const createRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!modal) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || form.get("title") || form.get("description") || "").trim();
    const amount = Number(form.get("amount") || 0);
    try {
      const endpoint = `/api/${modal === "project" ? "projects" : modal === "quote" ? "quotations" : modal === "expense" || modal === "expense-log" ? "expenses" : modal === "visit" ? "site-visits" : modal === "material" ? "materials" : modal === "material-request" ? "material-requests" : modal === "person" ? "people" : "progress"}`;
      const progressAttachments = modal === "progress" ? await readFileDataUrls(form.getAll("attachments")) : undefined;
      const attachment = modal === "expense" || modal === "expense-log" ? await readFileDataUrl(form.get("attachment")) : progressAttachments?.[0];
      const quotationFile = form.get("quotationFile");
      if (modal === "quote" && quotationFile instanceof File && quotationFile.size > 0) {
        if (!/\.pdf$/i.test(quotationFile.name) || (quotationFile.type && quotationFile.type !== "application/pdf")) {
          throw new Error("Quotation upload must be a PDF file.");
        }
      }
      const quotationAttachment = modal === "quote" ? await readFileDataUrl(quotationFile) : undefined;
      const body = {
        name,
        title: name,
        description: name,
        amount,
        project: form.get("project"),
        engineer: form.get("engineer") || (modal === "project" ? form.get("engineer") : currentUser),
        date: form.get("date"),
        site: form.get("site"),
        client: modal === "person" && form.get("role") === "Client" ? name : form.get("client"),
        quotationAmount: Number(form.get("quotationAmount") || 0),
        dueDate: form.get("dueDate"),
        material: form.get("material"),
        quantity: form.get("quantity"),
        note: form.get("note"),
        received: form.get("received"),
        used: form.get("used"),
        stock: form.get("stock"),
        email: form.get("email"),
        phone: form.get("phone"),
        role: form.get("role"),
        password: form.get("password"),
        submittedBy: currentUser,
        entryType: modal === "expense-log" ? "log" : "request",
        attachment,
        attachments: progressAttachments,
        quotationAttachment,
        stage: modal === "progress" ? form.get("stage") : undefined,
        progress: modal === "progress" ? form.get("progress") : undefined
      };
      const response = await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const result = await response.json() as { record?: Project | Quote | Expense | SiteVisit | Activity | Material | DashboardData["materialRequests"][number] | Person; project?: Project; error?: string };
      if (!response.ok) throw new Error(result.error || `Could not save record (${response.status})`);
      const record = result.record;
      if (!record) throw new Error("The API returned no saved record.");
      const updatedProject = result.project;
      if (modal === "project") {
        setData((current) => ({ ...current, projects: [record as Project, ...current.projects] }));
      } else if (modal === "quote") {
        setData((current) => ({ ...current, quotes: [record as Quote, ...current.quotes] }));
      } else if (modal === "expense") {
        setData((current) => ({ ...current, expenses: [record as Expense, ...current.expenses] }));
      } else if (modal === "visit") {
        setData((current) => ({ ...current, siteVisits: [record as SiteVisit, ...current.siteVisits] }));
      } else if (modal === "progress") {
        setData((current) => ({
          ...current,
          activities: [record as Activity, ...current.activities],
          projects: updatedProject
            ? current.projects.map((project) => project.id === updatedProject.id ? updatedProject : project)
            : current.projects
        }));
      } else if (modal === "material") {
        setData((current) => ({ ...current, materials: [record as Material, ...current.materials] }));
      } else if (modal === "material-request") {
        setData((current) => ({ ...current, materialRequests: [record as DashboardData["materialRequests"][number], ...current.materialRequests] }));
      } else if (modal === "person") {
        setData((current) => ({ ...current, people: [record as Person, ...current.people] }));
        if ((record as Person).role === "Client") {
          setData((current) => ({
            ...current,
            projects: current.projects.map((project) => project.name === (record as Person).project
              ? { ...project, client: (record as Person).name }
              : project)
          }));
        }
      }
      setModal(null);
      showToast(`${modal === "project" ? "Project" : modal === "quote" ? "Quotation" : modal === "expense" ? "Expense request" : modal === "expense-log" ? "Expense" : modal === "visit" ? "Site visit" : modal === "material" ? "Material entry" : modal === "material-request" ? "Material request" : modal === "person" ? "Person" : "Progress update"} saved.`);
    } catch (error) {
      console.error("Unable to save record:", error);
      showToast(error instanceof Error ? error.message : "Could not save this record.");
    }
  };

  const updateQuote = async (quote: Quote, decision: "Approved" | "Declined") => {
    try {
      const response = await apiFetch(`/api/quotations/${quote.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: decision }) });
      if (!response.ok) throw new Error(`Quotation update failed (${response.status})`);
      setData((current) => ({ ...current, quotes: current.quotes.map((item) => item.id === quote.id ? { ...item, status: decision } : item) }));
      showToast(`Quotation ${decision.toLowerCase()}.`);
    } catch (error) {
      console.error("Unable to update quotation:", error);
      showToast("Could not update quotation. Check the API connection.");
    }
  };

  const updateExpense = async (expense: Expense, status: "Approved" | "Declined" | "Paid") => {
    try {
      const response = await apiFetch(`/api/expenses/${expense.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const result = await response.json() as { record?: Expense; error?: string };
      if (!response.ok || !result.record) throw new Error(result.error || `Expense update failed (${response.status})`);
      setData((current) => ({ ...current, expenses: current.expenses.map((item) => item.id === expense.id ? result.record! : item) }));
      showToast(`Expense ${status.toLowerCase()}.`);
    } catch (error) {
      console.error("Unable to update expense:", error);
      showToast(error instanceof Error ? error.message : "Could not update expense.");
    }
  };

  const updateVisit = async (visit: SiteVisit, action: SiteVisitAction, proof: SiteVisitProof) => {
    try {
      const response = await apiFetch(`/api/site-visits/${visit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, engineer: currentUser, proof })
      });
      const result = await response.json() as { record?: SiteVisit; error?: string };
      if (!response.ok || !result.record) throw new Error(result.error || `Site visit update failed (${response.status})`);
      setData((current) => ({ ...current, siteVisits: current.siteVisits.map((item) => item.id === visit.id ? result.record! : item) }));
      showToast(`Site visit ${action === "check-in" ? "check-in" : "check-out"} saved.`);
    } catch (error) {
      console.error("Unable to update site visit:", error);
      const message = error instanceof Error ? error.message : "Could not update site visit.";
      showToast(message);
      throw error instanceof Error ? error : new Error(message);
    }
  };

  const removePerson = async (person: Person) => {
    try {
      const response = await apiFetch(`/api/people/${person.id}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || `Could not remove ${person.name} (${response.status})`);
      setData((current) => ({ ...current, people: current.people.filter((item) => item.id !== person.id) }));
      showToast(`${person.name} removed from the team list.`);
    } catch (error) {
      console.error("Unable to remove person:", error);
      showToast(error instanceof Error ? error.message : "Could not remove this person.");
    }
  };

  const updatePerson = async (person: Person, event: FormEvent<HTMLFormElement>) => {
    const form = new FormData(event.currentTarget);
    try {
      const response = await apiFetch(`/api/people/${person.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") ?? "").trim(),
          email: String(form.get("email") ?? "").trim(),
          phone: String(form.get("phone") ?? "").trim()
        })
      });
      const result = await response.json() as { record?: Person; error?: string };
      if (!response.ok || !result.record) throw new Error(result.error || `Could not update ${person.name} (${response.status})`);
      const updatedPerson = result.record;
      setData((current) => ({
        ...current,
        people: current.people.map((item) => item.id === person.id ? updatedPerson : item),
        projects: current.projects.map((project) => person.role === "Client"
          ? project.client === person.name ? { ...project, client: updatedPerson.name } : project
          : project.engineer === person.name ? { ...project, engineer: updatedPerson.name } : project),
        quotes: person.role === "Client" ? current.quotes.map((quote) => quote.client === person.name ? { ...quote, client: updatedPerson.name } : quote) : current.quotes,
        feedback: person.role === "Client" ? current.feedback.map((item) => item.client === person.name ? { ...item, client: updatedPerson.name } : item) : current.feedback,
        siteVisits: person.role === "Site Engineer" ? current.siteVisits.map((visit) => visit.engineer === person.name ? { ...visit, engineer: updatedPerson.name } : visit) : current.siteVisits,
        activities: person.role === "Site Engineer" ? current.activities.map((activity) => activity.actor === person.name ? { ...activity, actor: updatedPerson.name } : activity) : current.activities,
        expenses: person.role === "Site Engineer" ? current.expenses.map((expense) => expense.submittedBy === person.name ? { ...expense, submittedBy: updatedPerson.name } : expense) : current.expenses,
        attendance: person.role === "Site Engineer" ? current.attendance.map((record) => record.engineer === person.name ? { ...record, engineer: updatedPerson.name } : record) : current.attendance,
        materials: person.role === "Site Engineer" ? current.materials.map((material) => material.submittedBy === person.name ? { ...material, submittedBy: updatedPerson.name } : material) : current.materials,
        materialRequests: person.role === "Site Engineer" ? current.materialRequests.map((request) => request.requestedBy === person.name ? { ...request, requestedBy: updatedPerson.name } : request) : current.materialRequests
      }));
      showToast(`${updatedPerson.name} updated.`);
      return true;
    } catch (error) {
      console.error("Unable to update person:", error);
      showToast(error instanceof Error ? error.message : "Could not update this person.");
      return false;
    }
  };

  const submitAttendance = async (action: "check-in" | "check-out", date: string, proof: AttendanceProof) => {
    try {
      const response = await apiFetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engineer: currentUser, action, date, proof })
      });
      const result = await response.json() as { record?: Attendance; error?: string };
      if (!response.ok) throw new Error(result.error || `Attendance submission failed (${response.status})`);
      const savedRecord = result.record;
      if (!savedRecord) throw new Error("The attendance service returned no saved record.");
      setData((current) => ({
        ...current,
        attendance: [
          savedRecord,
          ...current.attendance.filter((record) =>
            record.id !== savedRecord.id &&
            !(record.engineer === savedRecord.engineer && record.date === savedRecord.date)
          )
        ]
      }));
      showToast(`${action === "check-in" ? "Check-in" : "Check-out"} recorded with photo and location.`);
    } catch (error) {
      console.error("Unable to submit attendance:", error);
      throw error;
    }
  };

  const regularizeAttendance = async (record: Attendance, capturedAt: string, reason: string) => {
    try {
      const response = await apiFetch(`/api/attendance/${record.id}/regularize`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capturedAt: new Date(capturedAt).toISOString(), reason, regularizedBy: currentUser })
      });
      const result = await response.json() as { record?: Attendance; error?: string };
      if (!response.ok || !result.record) throw new Error(result.error || `Attendance regularization failed (${response.status}).`);
      setData((current) => ({
        ...current,
        attendance: current.attendance.map((item) => item.id === result.record!.id ? result.record! : item)
      }));
      showToast(`Attendance for ${record.engineer} regularized as Present.`);
    } catch (error) {
      console.error("Unable to regularize attendance:", error);
      throw error instanceof Error ? error : new Error("Could not regularize attendance.");
    }
  };

  const reviewAttendanceRequest = async (requestId: string, decision: "Approved" | "Declined"): Promise<AttendanceRegularizationRequest> => {
    try {
      const response = await apiFetch(`/api/attendance/regularization-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reviewedBy: currentUser })
      });
      const result = await response.json() as { request?: AttendanceRegularizationRequest; record?: Attendance; error?: string };
      if (!response.ok || !result.request) throw new Error(result.error || `Attendance request review failed (${response.status}).`);
      if (result.record) {
        setData((current) => ({
          ...current,
          attendance: current.attendance.map((record) => record.id === result.record!.id ? result.record! : record)
        }));
      }
      showToast(decision === "Approved" ? "Attendance request approved and regularized." : "Attendance request declined.");
      return result.request;
    } catch (error) {
      console.error("Unable to review attendance regularization request:", error);
      throw error instanceof Error ? error : new Error("Could not review attendance request.");
    }
  };

  const reviewAttendanceLeaveRequest = async (requestId: string, decision: "Approved" | "Declined"): Promise<{ request: AttendanceLeaveRequest; record?: Attendance }> => {
    try {
      const response = await apiFetch(`/api/attendance/leave-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reviewedBy: currentUser })
      });
      const result = await response.json() as { request?: AttendanceLeaveRequest; record?: Attendance; error?: string };
      if (!response.ok || !result.request) throw new Error(result.error || `Leave request review failed (${response.status}).`);
      if (result.record) {
        setData((current) => ({
          ...current,
          attendance: [
            result.record!,
            ...current.attendance.filter((record) =>
              record.id !== result.record!.id &&
              !(record.engineer === result.record!.engineer && record.date === result.record!.date)
            )
          ]
        }));
      }
      showToast(decision === "Approved" ? "Leave request approved. The date is marked Off." : "Leave request declined.");
      return { request: result.request, ...(result.record ? { record: result.record } : {}) };
    } catch (error) {
      console.error("Unable to review attendance leave request:", error);
      throw error instanceof Error ? error : new Error("Could not review the leave request.");
    }
  };

  const submitFeedback = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const reviewWindow = window.open("about:blank", "_blank");
    if (reviewWindow) {
      reviewWindow.document.title = "Posting your review";
      reviewWindow.document.body.textContent = "Saving your review to BuildTrack…";
    }
    try {
      const response = await apiFetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: form.get("project"),
          comment: form.get("comment"),
          rating: Number(form.get("rating")),
          client: currentUser
        })
      });
      const result = await response.json() as { record?: Feedback; error?: string };
      if (!response.ok || !result.record) throw new Error(result.error || `Feedback request failed (${response.status}).`);
      setData((current) => ({ ...current, feedback: [result.record!, ...current.feedback] }));
      showToast("Your review was saved for the project owner and opened on Google.");
      formElement.reset();
      if (reviewWindow) reviewWindow.location.replace(googleReviewUrl);
      else window.location.assign(googleReviewUrl);
    } catch (error) {
      if (reviewWindow && !reviewWindow.closed) reviewWindow.close();
      console.error("Unable to submit client feedback:", error);
      showToast(error instanceof Error ? error.message : "Could not save your review.");
    }
  };

  const requestBackup = async () => {
    try {
      const response = await apiFetch("/api/backups", { method: "POST" });
      if (!response.ok) throw new Error(`Backup request failed (${response.status})`);
      const result = await response.json() as { record: Backup };
      setData((current) => ({ ...current, backups: [result.record, ...current.backups] }));
      showToast(`Backup ${result.record.id} requested. Status: ${result.record.status}.`);
    } catch (error) {
      console.error("Unable to request account backup:", error);
      showToast("Could not request a backup. Check the API connection.");
    }
  };

  const signOut = async () => {
    try {
      const response = await apiFetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: readRefreshToken() })
      });
      if (!response.ok) throw new Error(`Sign-out failed (${response.status})`);
    } catch (error) {
      console.error("API sign-out failed:", error);
    }
    localStorage.removeItem("buildtrack-session");
    clearAuthTokens();
    navigate("/signin", { replace: true });
  };

  const currentUser = userName;
  const pageDescription: Record<string, string> = {
    Dashboard: role === "Owner" ? "Here's your construction overview." : role === "Employee" ? "A clear view of your sites and today's priorities." : "Stay close to every detail of your project.",
    "Projects & Sites": "Manage active projects, sites, teams, and delivery dates.",
    "My Sites": "Your assigned sites, site tasks, and latest progress.",
    "My Projects": "Your construction projects, progress, and project payments.",
    Materials: "Track materials received, used, and remaining across your sites.",
    Expenses: "Keep project spending and receipt reviews in view.",
    Quotations: "Manage project quotations and additional work approvals.",
    "Progress Updates": "Share the latest site progress with your project team.",
    "Work Progress": role === "Owner" ? "Review site updates and photos shared by engineers." : "Follow construction updates and photos from your project.",
    Attendance: "Review daily attendance across your construction sites.",
    Reports: "Project-wise progress, expenses, materials, and activity.",
    "Financial Overview": "Review revenue, expenses, quotations, and profit across your projects.",
    "Site Visits": "Plan and follow up on engineer site visits.",
    "Settings & Backup": "Manage your profile and request an account data backup.",
    Settings: "Choose your personal color palette and workspace appearance.",
    Profile: "Manage your BuildTrack contact details and profile photo.",
    People: "Manage clients and engineers across your projects.",
    Timeline: "Follow project milestones and site updates.",
    Feedback: "Rate your experience on Google."
  };
  const pageTitle = page === "Dashboard" ? `${role} Dashboard` : page;
  const featurePageProps = {
    currentUser,
    currentUserEmail: userEmail,
    data,
    projects: visibleProjects,
    search,
    setSearch,
    filter,
    setFilter,
    onCreate: setModal,
    onQuote: updateQuote,
    onExpenseStatus: updateExpense,
    onVisitStatus: updateVisit,
    onUpdatePerson: updatePerson,
    onRemovePerson: removePerson,
    onAttendanceSubmit: submitAttendance,
    onAttendanceRegularize: regularizeAttendance,
    onAttendanceRequestReview: reviewAttendanceRequest,
    onAttendanceLeaveReview: reviewAttendanceLeaveRequest,
    onToast: showToast,
    onFeedback: submitFeedback,
    onBackup: requestBackup
  };

  return (
    <div className="app-frame">
      <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
        <Link className="brand" to={rolePath(roleId(role))} aria-label="Vanya BuildTrack home">
          <span className="brand-mark"><BuildingIcon /></span>
          <span className="brand-copy"><strong>Vanya BuildTrack</strong><small>Construction workspace</small></span>
        </Link>
        {role === "Client" ? <div className="profile">
          <span className="avatar">{initials(currentUser)}</span>
          <span className="profile-copy"><strong>{currentUser}</strong><small>{role}</small></span>
        </div> : <Link className="profile" to={pagePath(role, "Profile")} aria-label={`View profile for ${currentUser}`} onClick={() => setMobileNavOpen(false)}>
          <span className="avatar">{profileImage ? <img src={profileImage} alt="" /> : initials(currentUser)}</span>
          <span className="profile-copy"><strong>{currentUser}</strong><small>{role === "Owner" ? "Company Admin" : role}</small></span>
        </Link>}
        <div className="nav-label">WORKSPACE</div>
        <nav className="side-nav" aria-label={`${role} navigation`}>
          {navigation[role].map((item) => (
            <button key={item.label} className={`nav-item ${page === item.label ? "nav-active" : ""}`} onClick={() => { navigateToPage(item.label); setMobileNavOpen(false); }}>
              <span className="nav-icon">{item.icon}</span><span>{item.label}</span>
              {item.label === "Quotations" && role === "Owner" && data.quotes.filter((quote) => quote.status.toLowerCase().includes("review")).length > 0 && <span className="nav-count">{data.quotes.filter((quote) => quote.status.toLowerCase().includes("review")).length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {role === "Owner"
            ? <button className={`nav-item ${page === "Settings & Backup" ? "nav-active" : ""}`} onClick={() => { navigateToPage("Settings & Backup"); setMobileNavOpen(false); }}><span className="nav-icon">⚙</span><span>Settings & Backup</span></button>
            : <button className={`nav-item ${page === "Settings" ? "nav-active" : ""}`} onClick={() => { navigateToPage("Settings"); setMobileNavOpen(false); }}><span className="nav-icon">⚙</span><span>Settings</span></button>}
          <div className="sidebar-divider" />
          <button className="logout-button" onClick={() => void signOut()}><span>↪</span> Sign out</button>
        </div>
      </aside>

      <main className="main-shell">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileNavOpen(!mobileNavOpen)}>☰</button>
          <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{page}</strong></div>
          <div className="topbar-actions">
            <button className="icon-button notification-button" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0" /></svg><i /></button>
            {role === "Client" ? <div className="top-avatar" aria-label={`${currentUser} avatar`}>{initials(currentUser)}</div> : <Link className="top-avatar" to={pagePath(role, "Profile")} aria-label={`View profile for ${currentUser}`}>{profileImage ? <img src={profileImage} alt="" /> : initials(currentUser)}</Link>}
          </div>
        </header>

        <div className={`content-area ${page === "Settings" || page === "Settings & Backup" ? "content-area-settings" : ""}`}>
          <section className="page-heading">
            <div><div className="eyebrow"><span className="eyebrow-dot" /> BUILDTRACK / {role.toUpperCase()}</div><h1>{pageTitle}</h1><p>{pageDescription[page] || "Your construction workspace at a glance."}</p></div>
            <div className="heading-actions">
              {role === "Owner" && page === "Dashboard" && <button className="button button-primary" onClick={() => setModal("project")}><span>＋</span> New project</button>}
              {role === "Employee" && page === "Dashboard" && <button className="button button-primary" onClick={() => setModal("progress")}><span>＋</span> Add update</button>}
              {role === "Client" && page === "Dashboard" && <button className="button button-secondary" onClick={() => navigateToPage("Quotations")}>View quotations <span>↗</span></button>}
            </div>
          </section>

          {page === "Profile" && role !== "Client" && <AccountProfilePage role={role} email={userEmail} onProfileImageChange={setProfileImage} />}
          {page === "Dashboard" && role === "Owner" && <OwnerDashboard data={data} onNavigate={navigateToPage} onCreate={setModal} onOpenProject={(project) => { setSearch(project.name); navigateToPage("Projects & Sites"); }} />}
          {page === "Dashboard" && role === "Employee" && <EngineerDashboard data={data} currentUser={currentUser} onNavigate={navigateToPage} />}
          {page === "Dashboard" && role === "Client" && <ClientDashboard data={data} currentUser={currentUser} currentUserEmail={userEmail} onNavigate={navigateToPage} onQuote={updateQuote} />}
          {page === "Financial Overview" && role === "Owner" && <OwnerFinancialReport data={data} onBack={() => navigateToPage("Dashboard")} />}
          {page !== "Dashboard" && role === "Owner" && page === "Projects & Sites" && <OwnerProjectsPage {...featurePageProps} />}
          {page !== "Dashboard" && role === "Owner" && page === "Materials" && <OwnerMaterialsPage {...featurePageProps} />}
          {page !== "Dashboard" && page !== "Profile" && !(role === "Owner" && (page === "Projects & Sites" || page === "Materials" || page === "Financial Overview")) && <FeaturePage {...featurePageProps} page={page} role={role} />}

          <footer className="footer"><span>© 2026 Vanya BuildTrack</span><span>Built for the people who build.</span><nav className="footer-legal" aria-label="Legal"><Link to="/privacy-policy">Privacy</Link><Link to="/data-usage">Data Usage</Link></nav><span className="footer-status"><i /> All systems operational</span></footer>
        </div>
      </main>
      {mobileNavOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      {notificationsOpen && <>
        <button className="notification-scrim" aria-label="Close notifications" onClick={() => setNotificationsOpen(false)} />
        <aside className="notification-drawer" role="dialog" aria-modal="true" aria-labelledby="notification-title">
          <header className="notification-heading">
            <div><span className="panel-kicker">{role.toUpperCase()} WORKSPACE</span><h2 id="notification-title">Notifications</h2><p>Updates that need your attention.</p></div>
            <button className="icon-button notification-close" aria-label="Close notifications" onClick={() => setNotificationsOpen(false)}>×</button>
          </header>
          <div className="push-notification-control"><div><strong>Browser push notifications</strong><span>{pushStatus === "enabled" ? "Enabled on this device." : pushStatus === "checking" ? "Checking browser and server support…" : pushStatus === "unsupported" ? "This browser does not support push notifications." : pushStatus === "unconfigured" ? "Push delivery needs server VAPID configuration." : pushStatus === "denied" ? "Permission is blocked in browser settings." : pushStatus === "error" ? "Could not update push settings. Try again." : role === "Owner" ? "Get quotation approvals, expense and material requests outside the app." : role === "Employee" ? "Get project and work update alerts on this device." : "Get new quotation and work updates for your project outside the app."}</span></div><button className="button button-outline" disabled={pushStatus === "checking" || pushStatus === "unsupported" || pushStatus === "unconfigured" || pushStatus === "denied"} onClick={() => void togglePushNotifications()}>{pushStatus === "enabled" ? "Turn off" : pushStatus === "checking" ? "Checking…" : pushStatus === "unconfigured" ? "Unavailable" : pushStatus === "denied" ? "Blocked" : pushStatus === "error" ? "Try again" : "Enable"}</button></div>
          {notifications.length > 0
            ? <div className="notification-list">{notifications.map((item, index) => (
              <button className="notification-item" key={`${item.title}-${item.detail}-${index}`} onClick={() => { setNotificationsOpen(false); navigateToPage(item.page); }}>
                <span className="notification-item-icon">{item.icon}</span>
                <span className="notification-item-copy"><strong>{item.title}</strong><span>{item.detail}</span><small>{item.time}</small></span>
                <span className="notification-arrow">›</span>
              </button>
            ))}</div>
            : <div className="notification-empty"><span>✓</span><strong>You’re all caught up</strong><p>New updates will appear here.</p></div>}
        </aside>
      </>}
      {toast && <div className="toast"><span className="toast-check">✓</span>{toast}<button aria-label="Dismiss notification" onClick={() => setToast("")}>×</button></div>}
      {modal && <RecordModal modal={modal} projects={data.projects} people={data.people} onClose={() => setModal(null)} onSubmit={createRecord} />}
    </div>
  );
}
