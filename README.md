# Vanya BuildTrack

A construction project management SaaS starter with role-based Owner, Site Engineer, and Client portals. The frontend is React + TypeScript; the backend is Node.js, Express, and TypeScript.

## Run the demo

Requirements: Node.js 20.19+ or 22.12+, and npm.

```powershell
npm install
npm run dev
```

Open http://localhost:5173. The public landing page is `/`, the sign-in page is `/signin`, and the three role portals are `/admin`, `/employee`, and `/client`. Portal pages have role-specific subroutes such as `/admin/projects-sites`, `/employee/progress-updates`, and `/client/quotations`.

The Express mock API runs at http://localhost:3001 and the Vite development server proxies `/api` requests to it. Use the demo access shortcuts on `/signin` to fill an account for each portal:

| Role | Email | Password |
| --- | --- | --- |
| Owner | `owner@vanya.com` | `owner123` |
| Employee | `employee@vanya.com` | `employee123` |
| Client | `client@vanya.com` | `client123` |

**Database setup is not required.** The API stores all workspace records in `backend/data/buildtrack.json` and writes updates to disk, so changes survive backend restarts. Set `BUILDTRACK_DATA_FILE` to use a different JSON file. The file is local runtime data and is ignored by Git. Prisma, the PostgreSQL schema, migrations, and optional Docker Compose service remain available for a future database-backed implementation; they are not used by the demo API.

### Backend architecture

The API uses TSOA decorators to generate Express route registration from the feature controllers in `backend/src/features`. Each feature is organized into `controller.ts` (HTTP paths and status responses), `service.ts` (validation and business rules), and `data.ts` (feature data access). `backend/src/data/store.ts` owns seeded records, sequence recovery, and atomic JSON-file persistence. `backend/src/index.ts` configures Express and registers the generated routes.

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
- `GET`, `POST /api/projects`, `PATCH /api/projects/:id`, and `DELETE /api/projects/:id` — manage projects.
- `GET`, `POST /api/quotations`, and `PATCH /api/quotations/:id` — manage quotations and client decisions.
- `GET`, `POST /api/expenses`, and `PATCH /api/expenses/:id` — submit expenses and update review status.
- `GET` and `POST /api/progress` — list progress updates and submit updates with optional photo attachments.
- `GET` and `POST /api/materials` — list inventory and log received/used materials.
- `GET`, `POST /api/site-visits`, and `PATCH /api/site-visits/:id` — schedule visits and mark them complete or cancelled.
- `GET` and `POST /api/attendance` — retrieve attendance and record photo/location-backed check-in and check-out.
- `GET`, `POST /api/people`, and `DELETE /api/people/:id` — manage the workspace people list.
- `GET` and `POST /api/feedback` — list and submit demo client feedback.
- `GET /api/backups`, `POST /api/backups`, and `GET /api/backups/:id/download` — create and download workspace JSON backups.
- `GET /api/reports/:type` — build project, expense, material, attendance, and progress reports.

The JSON file is a lightweight local persistence option, not a multi-user database. Demo sign-in checks seeded role credentials and stores the selected user in browser local storage; it is not production authentication and is not suitable for sensitive data or concurrent multi-instance deployments.
