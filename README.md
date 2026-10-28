# Vanya BuildTrack

A construction project management SaaS starter with role-based Owner, Site Engineer, and Client portals. The frontend is React + TypeScript; the backend is Node.js, Express, and TypeScript.

## Run the demo

Requirements: Node.js 20.19+ or 22.12+, and npm.

```powershell
npm install
npm run dev
```

Open http://localhost:5173. The public landing page is `/`, the sign-in page is `/signin`, and the three role portals are `/admin`, `/employee`, and `/client`. Portal pages have role-specific subroutes such as `/admin/projects-sites`, `/employee/progress-updates`, and `/client/quotations`.

### Install the app

BuildTrack can be installed from its landing page as a progressive web app. On a supported browser, select **Install app** to open the browser's install prompt. On iPhone or iPad, select **Install app** for the Safari **Share → Add to Home Screen** steps. App installation requires a secure site (HTTPS, or localhost for development).

The Express mock API runs at http://localhost:3001 and the Vite development server proxies `/api` requests to it. Use the demo access shortcuts on `/signin` to fill an account for each portal:

| Role | Email | Password |
| --- | --- | --- |
| Owner | `owner@vanya.com` | `owner123` |
| Employee | `employee@vanya.com` | `employee123` |
| Client | `client@vanya.com` | `client123` |

**Database setup is not required.** The API stores all workspace records in `backend/data/buildtrack.json` and writes updates to disk, so changes survive backend restarts. Set `BUILDTRACK_DATA_FILE` to use a different JSON file. The file is local runtime data and is ignored by Git. Prisma, the PostgreSQL schema, migrations, and optional Docker Compose service remain available for a future database-backed implementation; they are not used by the demo API.

Site engineers can set overall project completion and mark a photo's stage when submitting a progress update. When a project reaches 100%, its client can open a completion report from the project details, compare photos marked as project start and completion (or the earliest and latest uploaded photos), submit a rating and feedback, and open the Google review page. To link directly to the business's Google review form, set `VITE_GOOGLE_REVIEW_URL` to the Google Business Profile review URL in `frontend/.env`; without it, the report links to a Google Maps search for Vanya BuildTrack.

### Browser push notifications

Owners, site engineers, and clients can enable browser push from the in-app Notifications drawer. Push alerts are delivered to owners for engineer-submitted expense and material requests, and to owners plus the assigned client for engineer work updates, including when the app is not open. In-app notifications continue to work independently.

Web Push requires HTTPS (localhost is supported for local development). If VAPID keys are not set, the backend generates a key pair on first start and persists it in the ignored `backend/data/vapid-keys.json` file so subscriptions continue to work after restarts. Keep this file and the private key secure, and persist the key file across deployments. For production, set `VAPID_SUBJECT` to a monitored contact address. To manage keys yourself, generate them with `npx web-push generate-vapid-keys` and set both `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in `backend/.env`, based on `backend/.env.example`. Browser push requires permission on each device; in-app notifications continue to work independently.

### Backend architecture

The API uses TSOA decorators to generate Express route registration from the feature controllers in `backend/src/features`. Each feature is organized into `controller.ts` (HTTP paths and status responses), `service.ts` (validation and business rules), and `data.ts` (feature data access). `backend/src/data/store.ts` owns seeded records, sequence recovery, and atomic JSON-file persistence. `backend/src/index.ts` configures Express and registers the generated routes.

Profile QR codes link to the frontend origin. In local development, the API derives it from the request host and maps port `3001` to Vite's default port `5173`. If the frontend is hosted separately in production, set `FRONTEND_URL` to its public origin (for example, `https://buildtrack.example.com`).

Route and OpenAPI generation are configured for the backend. Build generates both automatically; they can also be generated explicitly:

```powershell
cd backend
npm run generate
npm run build
```

The generated Express bindings are written under `backend/src/generated`, and the OpenAPI document under `backend/openapi`. The TSOA configuration is `backend/tsoa.json`.

## Available commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the frontend and mock API in watch mode |
| `npm run build` | Build both workspaces |
| `npm run db:up` | Start the optional local PostgreSQL container |
| `npm run db:down` | Stop the optional PostgreSQL container |
| `npm run db:migrate` | Generate the Prisma client and run development migrations |
| `npm run db:deploy` | Apply existing migrations in a deployment |
| `npm run db:studio` | Open Prisma Studio |

## Demo API

The dashboard loads its initial data from `GET /api/dashboard`. Feature pages request their own data from the matching resource endpoint.

- `GET /api/health` — mock API status; no database connection is made.
- `POST /api/auth/login` and `POST /api/auth/logout` — demo role sign-in and sign-out.
- `GET /api/profiles/me?role=...&email=...`, `PATCH /api/profiles/me?role=...&email=...`, and `GET /api/profiles/:id` — load and update account profile phone numbers, generate owner/engineer QR codes, or view a QR-linked public profile.
- `GET /api/push/config`, `POST /api/push/subscriptions`, and `DELETE /api/push/subscriptions` — configure owner browser push subscriptions.
- `GET`, `POST /api/projects`, `PATCH /api/projects/:id`, and `DELETE /api/projects/:id` — manage projects.
- `GET`, `POST /api/quotations`, and `PATCH /api/quotations/:id` — manage quotations and client decisions.
- `GET`, `POST /api/expenses`, and `PATCH /api/expenses/:id` — submit expenses and update review status.
- `GET` and `POST /api/progress` — list progress updates and submit updates with optional photo attachments.
- `GET` and `POST /api/materials` — list inventory and log received/used materials.
- `GET` and `POST /api/material-requests` — list and submit engineer material requests.
- `GET`, `POST /api/site-visits`, and `PATCH /api/site-visits/:id` — schedule visits and mark them complete or cancelled.
- `GET` and `POST /api/attendance` — retrieve attendance and record photo/location-backed check-in and check-out; an unfinished check-in becomes absent 24 hours after check-in, and a late employee check-out is rejected. `PATCH /api/attendance/:id/regularize` lets an owner enter the actual check-out time and reason for a missed check-out. `/api/attendance/leaves` supports listing, adding, and deleting owner-managed leave dates. Sundays and scheduled leave dates are treated as non-working days, not absences.
- `GET`, `POST /api/people`, and `DELETE /api/people/:id` — manage the workspace people list; new site engineers receive login credentials set by the owner.
- `GET` and `POST /api/feedback` — list and submit demo client feedback.
- `GET /api/backups`, `POST /api/backups`, and `GET /api/backups/:id/download` — create and download workspace JSON backups.
- `GET /api/reports/:type` — build project, expense, material, attendance, and progress reports.

The JSON file is a lightweight local persistence option, not a multi-user database. Demo sign-in supports the seeded role credentials and credentials set when an owner adds a site engineer or client. Invited employee and client passwords are stored as salted hashes in the local JSON file. Sign-in stores the selected user in browser local storage; this is not production authentication and is not suitable for sensitive data or concurrent multi-instance deployments.
