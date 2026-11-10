# Vanya BuildTrack

A construction project management SaaS starter with role-based Owner, Site Engineer, and Client portals. The frontend is a React + TypeScript single-page application; the backend is Node.js, Express, and TypeScript.

## Run BuildTrack

Requirements: Node.js 20.19+ or 22.12+, and npm.

```powershell
npm install
npm run dev
```

Open http://localhost:5173. The public landing page is `/`, the sign-in page is `/signin`, and the three role portals are `/admin`, `/employee`, and `/client`. Portal pages have role-specific subroutes such as `/admin/projects-sites`, `/employee/progress-updates`, and `/client/quotations`.

### Install the app

BuildTrack can be installed from its landing page as a progressive web app. On a supported browser, select **Install app** to open the browser's install prompt. On iPhone or iPad, select **Install app** for the Safari **Share → Add to Home Screen** steps. App installation requires a secure site (HTTPS, or localhost for development).

The Vite frontend runs at http://localhost:5173 and the Express API runs at http://localhost:3001. The backend applies its SQLite migration automatically when it starts.

Use the **Demo mode** toggle in the header to choose between:

- **Demo mode:** sample data and sign-in are handled entirely in the browser. CRUD operations work and changes persist in that browser's local storage; no backend API requests are made.
- **Real mode (default):** sign-in and workspace data use the SQLite database at `backend/data/buildtrack.db`. A new database starts empty and requires one-time owner setup.

### Deploy to a VPS with UAT and production

The Docker deployment builds the React frontend and serves its static files from Express on the same origin as the API. UAT and production run as separate containers, have separate SQLite/VAPID data volumes, and bind only to localhost ports `3101` and `3102`; use a reverse proxy for public HTTPS access.

Before deploying, point `vanyabuildtrackuat.duckdns.org` (UAT) and `vanyabuildtrack.duckdns.org` (production) at the VPS public IP. Install Docker Engine with the Compose plugin and Nginx on the VPS, then clone this repository. No deployment `.env` files or environment password settings are needed; the domains are configured in `docker-compose.yml`.

Each fresh environment prints a random one-time setup code in its container logs. The setup page asks for two owner accounts and their login passwords, and the code prevents an unauthenticated visitor from claiming the new workspace. Choose strong, unique passwords and keep them private; the passwords are entered in the setup page and stored only as salted hashes in the database.

Start either environment independently:

```sh
docker compose --profile uat up -d --build
docker compose --profile prod up -d --build
```

The first start applies SQLite migrations automatically. Configure Nginx using `deploy/nginx-buildtrack.conf.example`, enable that site, then obtain HTTPS certificates with Certbot's Nginx plugin for both DNS names. The example proxy disables buffering so the app's live-update event stream works. Only ports 80 and 443 need to be publicly reachable; the app ports are bound to `127.0.0.1`.

Before exposing a fresh environment publicly, retrieve its setup code over SSH:

```sh
docker compose --profile uat logs --tail=100
docker compose --profile prod logs --tail=100
```

Open the corresponding HTTPS domain, choose **Complete initial setup**, and enter that environment's setup code and two owner accounts. The random code is displayed only in the server logs and becomes invalid after setup or an application restart. UAT and production use different codes and separate databases.

To deploy an update, pull the desired code and run the matching `docker compose --profile ... up -d --build` command. Back up each environment's SQLite workspace before upgrades or VPS maintenance. The named volumes `buildtrack-uat-data` and `buildtrack-prod-data` contain the databases and generated push keys; do not remove them when updating containers.

This project still describes its real-mode authentication as a starter rather than production-ready. Review and harden authentication/authorization and operational backup/restore procedures before using it with sensitive production data.

Demo credentials are available when Demo mode is on:

| Role | Email | Password |
| --- | --- | --- |
| Owner | `varun@vanya.com` or `chaitanya@vanya.com` | `owner123` |
| Employee | `employee@vanya.com` | `employee123` |
| Client | `client@vanya.com` | `client123` |

Real mode provides two full-access owner accounts: the initial setup page lets you choose their names, emails, and passwords. Passwords are saved only as salted hashes in the workspace database and are not needed from the environment on later restarts. Successful owner changes are attributed to the signed-in owner and appear in **Settings & Backup → Audit log**. Create employee and client logins from either owner's **People** page. The old ignored `backend/data/buildtrack.json` file is not read or imported.

Site engineers can set overall project completion and mark a photo's stage when submitting a progress update. When a project reaches 100%, its client can open a completion report from the project details and compare photos marked as project start and completion (or the earliest and latest uploaded photos). On the client Feedback page, a rating and comment can be saved in BuildTrack for the owner and posted publicly through the Google review page. The default Google link opens the Vanya Concrete Technologies listing, where clients can select **Write a review**. To use a direct review form link instead, set `VITE_GOOGLE_REVIEW_URL` in `frontend/.env`.

### Browser push notifications

Owners, site engineers, and clients can enable browser push from the in-app Notifications drawer. Push alerts are delivered to owners for engineer-submitted expense and material requests, and to owners plus the assigned client for engineer work updates, including when the app is not open. In-app notifications continue to work independently.

Web Push requires HTTPS (localhost is supported for local development). If VAPID keys are not set, the backend generates a key pair on first start and persists it in the ignored `backend/data/vapid-keys.json` file so subscriptions continue to work after restarts. Keep this file and the private key secure, and persist the key file across deployments. For production, set `VAPID_SUBJECT` to a monitored contact address. To manage keys yourself, generate them with `npx web-push generate-vapid-keys` and set both `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in `backend/.env`, based on `backend/.env.example`. Browser push requires permission on each device; in-app notifications continue to work independently.

### Backend architecture

The API uses TSOA decorators to generate Express route registration from the feature controllers in `backend/src/features`. Each feature is organized into `controller.ts` (HTTP paths and status responses), `service.ts` (validation and business rules), and `data.ts` (feature data access). `backend/src/data/store.ts` owns empty live-mode collections, account credentials, sequence recovery, and SQLite persistence. Demo records and local demo request handling live in the frontend.

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
| `npm run dev` | Start the frontend and SQLite-backed API in watch mode |
| `npm run build` | Build both workspaces |
| `npm run db:migrate` | Generate the Prisma client and run SQLite development migrations |
| `npm run db:deploy` | Apply SQLite migrations |
| `npm run db:studio` | Open Prisma Studio for the SQLite database |

## Real-mode API

The dashboard loads its initial data from `GET /api/dashboard`. Feature pages request their own data from the matching resource endpoint.

- `GET /api/health` — API and SQLite status.
- `POST /api/auth/login` and `POST /api/auth/logout` — real-mode sign-in and sign-out.
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

The SQLite database currently stores the workspace state as a single serialized record to keep the existing feature services compatible while replacing the JSON-file datastore. Employee and client passwords are salted and hashed before storage. Browser sessions remain client-side; this app is still a local starter and should not be treated as production-ready authentication or multi-tenant authorization.
