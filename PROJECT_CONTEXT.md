# Vanya BuildTrack — AI Project Context

Use this document to orient future AI assistants working in this repository. It summarizes the product, architecture, development workflow, and important implementation constraints. Treat the source code and current repository state as authoritative if they differ from this document.

## Project at a glance

- **Product:** Vanya BuildTrack, a construction project management workspace for owners, site engineers, and clients.
- **Repository:** `SkyOos-source/Vanya-BuildTrack`
- **Frontend:** React 18, TypeScript, Vite, React Router.
- **Backend:** Node.js, Express, TypeScript, TSOA-generated API routes.
- **Persistence:** Real mode uses a local SQLite database through Prisma. Demo mode is frontend-only and stores its sample workspace in browser local storage.
- **Application style:** Responsive, role-based portals with an orange, charcoal, and off-white visual system.
- **Primary product documentation:** `README.md` (setup and API), `FEATURES.md` (product feature summary), and `DESIGN.md` (UI direction).

## Product and user roles

### Owner

Manages projects and sites, clients and engineers, quotations, expenses, materials, attendance, site visits, reports, feedback, and backups. Reviews and acts on submissions.

### Site engineer

Views assigned sites and project information; submits construction progress and photos, updates overall completion, tracks materials, requests expenses/materials, records attendance, and views site visits and owner instructions.

### Client

Views assigned projects, timelines, progress photos, and quotations; responds to quotations and can open the Google review page.

### Access boundaries

Pages and data are intended to be role-scoped. Demo mode is frontend-only; real mode calls the SQLite-backed API. Browser sessions remain client-side, so this is not production authentication or a multi-tenant authorization system.

## Application routes

- `/` — public landing page
- `/signin` — mode-aware sign-in
- `/privacy-policy`, `/data-usage` — legal/information pages
- `/profile/:id` — public contact profile reached from QR code
- `/admin/*` — owner portal
- `/employee/*` — site engineer portal
- `/client/*` — client portal

Portal page slugs and role-specific navigation are centralized in `frontend/src/common/data.ts`. `frontend/src/common/portal-app.tsx` provides portal routing, app shell, data loading, and shared record actions. `frontend/src/common/feature-page.tsx` renders most shared feature pages. Dedicated dashboard and owner project/material views are under `frontend/src/owner`, `frontend/src/engineer`, and `frontend/src/client`.

## Repository map

### Frontend

- `frontend/src/App.tsx` — top-level public and portal routes.
- `frontend/src/auth/` — sign-in UI.
- `frontend/src/landing/` — public landing page.
- `frontend/src/common/portal-app.tsx` — role-protected portal shell, API loading, notifications, and shared actions.
- `frontend/src/common/data.ts` — navigation, route-slug helpers, mode selection, and frontend demo data.
- `frontend/src/common/api.ts` — local demo-mode request handling and real-mode API forwarding.
- `frontend/src/common/types.ts` — shared frontend domain types.
- `frontend/src/common/components.tsx` — shared UI components and record modal forms.
- `frontend/src/common/feature-page.tsx` — shared project and feature views.
- `frontend/src/common/project-details.tsx` — project details and client completion report.
- `frontend/src/common/profile-page.tsx` — private and QR-linked public profiles.
- `frontend/src/style.css` — application-wide styling and responsive rules.
- `frontend/public/` — app icons, manifest, service worker, and sample quotation PDFs.

### Backend

- `backend/src/index.ts` — Express app, JSON parsing, SQLite persistence hook, realtime event stream, push endpoints, route registration, and error handler.
- `backend/src/features/<feature>/controller.ts` — TSOA controller and HTTP route declarations.
- `backend/src/features/<feature>/service.ts` — validation and feature logic.
- `backend/src/features/<feature>/data.ts` — feature data access/re-exports.
- `backend/src/data/store.ts` — empty live-mode collections, account credentials, input readers, ID sequences, and SQLite persistence.
- `backend/src/realtime.ts` — workspace event subscription/publication.
- `backend/src/push.ts` — VAPID configuration and Web Push support.
- `backend/src/generated/routes.ts` — generated Express routes; do not hand-edit.
- `backend/openapi/swagger.json` — generated OpenAPI specification; regenerate through the backend scripts rather than hand-editing.
- `backend/prisma/` — SQLite schema and migrations for the live API.

## Backend API overview

Feature routes are declared in `backend/src/features` and generated into `backend/src/generated/routes.ts`.

- `/api/health`, `/api/dashboard`
- `/api/auth/login`, `/api/auth/logout`
- `/api/profiles/me`, `/api/profiles/:id`
- `/api/projects`
- `/api/quotations`
- `/api/expenses`
- `/api/progress`
- `/api/materials`, `/api/material-requests`
- `/api/site-visits`
- `/api/attendance`, `/api/attendance/leaves`
- `/api/people`
- `/api/feedback`
- `/api/backups`
- `/api/reports/:type`
- `/api/events` (Server-Sent Events)
- `/api/push/config`, `/api/push/subscriptions`

See `README.md` for the fuller endpoint and behavior list. Follow the existing controller → service → data pattern for feature changes. Validate user input explicitly with the readers/helpers in `backend/src/data/store.ts` and return repository-style `failure(...)` or `result(...)` values from services.

## Current completion report and feedback flow

- A progress submission can include an overall project completion percentage from 0 to 100 and a photo stage: `Start`, `Progress`, or `Completion`.
- The backend validates and stores the progress activity, updates the matching project's percentage when a percentage is supplied, persists the response, and publishes a progress workspace update.
- The client project details page shows **Get the project report** only when the project progress is at least 100%.
- The completion report displays project facts and compares photos marked `Start` and `Completion`. Where a stage is not marked, the first/last chronological photo is used. If only one image exists, the report explains the limitation.
- The report includes a print/save action and a link that opens the configured Google review page. The client Feedback page lets clients save a rating and comment to the existing `/api/feedback` API for the owner, then open the same Google review link to post it publicly.
- The default review link opens the verified Google Maps listing for Vanya Concrete Technologies; clients can choose **Write a review** there. Set `VITE_GOOGLE_REVIEW_URL` in `frontend/.env` to override it with a direct review-form URL.
- The engineer progress form is in `frontend/src/common/components.tsx`; payload handling is in `frontend/src/common/portal-app.tsx`; backend validation/update logic is in `backend/src/features/progress/service.ts`.

## Data, persistence, and uploads

- Real mode persists workspace state in the SQLite database at `backend/data/buildtrack.db`; Prisma migrations are applied by the backend start scripts.
- Successful non-GET/HEAD/OPTIONS API responses trigger SQLite persistence in `backend/src/index.ts`.
- Live-mode collections start empty except for the initial owner account. Sample records and demo sign-in are in the frontend.
- Backend IDs are generated by per-record sequences; sequence counters are recovered from loaded data.
- Image/PDF attachments are data URLs with validation/size limits. New attachment types must be supported by both frontend file handling and backend validation.
- Do not overwrite or reset `backend/data/buildtrack.json` or other local runtime data unless explicitly asked.
- Invited engineer/client passwords and the initial owner password are stored as salted hashes in SQLite. Demo credentials and sample records are documented in `README.md`; they are only used by frontend demo mode.

## Development and verification

Requirements: Node.js 20.19+ or 22.12+ and npm.

From the repository root in PowerShell:

```powershell
npm install
npm run dev
npm run build
```

The dev command starts the API at `http://localhost:3001` and Vite at `http://localhost:5173`; Vite proxies real-mode `/api` requests to the API. Backend startup applies the SQLite migration.

Useful focused checks:

```powershell
npm run build --workspace @buildtrack/frontend
npx tsc -p backend/tsconfig.json --noEmit
git diff --check
```

Backend route/OpenAPI generation and build:

```powershell
cd backend
npm run generate
npm run build
```

The root `npm run build` runs both workspace builds. No dedicated test script is defined in the package manifests; prefer the smallest relevant build/typecheck and existing tests if added later.

`db:migrate`, `db:deploy`, and `db:studio` operate on the SQLite database used by real mode.

## Configuration and deployment notes

- Vite API proxy: `frontend/vite.config.ts`.
- API port defaults to `3001` and can be overridden with `PORT`.
- Set `FRONTEND_URL` when the frontend is hosted separately; it is used for generated profile links.
- Web Push uses VAPID settings. Backend can generate and persist keys under ignored `backend/data/vapid-keys.json`; keep any private VAPID key secure and persistent in deployment. Set `VAPID_SUBJECT` to a monitored contact address in production.
- Frontend Google review override: `VITE_GOOGLE_REVIEW_URL`.
- Vite variables are embedded at build time; rebuild/redeploy the frontend after changing them.
- The repository includes PWA manifest/service-worker behavior. Test push and installation over HTTPS, except localhost which is treated as secure by browsers.

## UI and implementation conventions

- Preserve the warm orange, charcoal, off-white palette and responsive behavior documented in `DESIGN.md`.
- Reuse existing components, feature-service patterns, types, and page navigation utilities before adding abstractions.
- Keep error paths visible: log/report API failures and show a useful user-facing message rather than silently accepting failed writes.
- Keep both Owner and Client project-details call sites compatible when changing `ProjectDetails`.
- Keep progress entries and project completion values consistent in API responses and frontend state. The client project list loads progress activities so the report has photo context; realtime progress refreshes project records too.
- Progress attachments are not necessarily photos: the existing validator supports image and PDF data URLs. If a report relies on an attachment as an image, validate/filter for image MIME types before rendering.
- Generated route/spec files should be changed only by running the existing TSOA generation scripts.
- Avoid editing unrelated dirty worktree changes. Inspect `git status` before touching files, and preserve changes not made for the current task.

## Product limitations and future implementation considerations

- The backend is not a production-ready multi-user service. It has no database-backed tenancy, server-side session security, or complete production authorization layer.
- For production, design a real identity provider/session strategy, tenant/project access checks on every API operation and file, database persistence/migrations, scalable attachment storage, backup/retention, and operational error handling.
- Business-specific Google review, external links, and production deployment settings must be provided/configured; do not fabricate them.
- `FEATURES.md` is a product description and can describe intended behavior beyond what exists in code. Verify implementation in source before asserting a feature is complete.
