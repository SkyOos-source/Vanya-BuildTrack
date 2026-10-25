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

**Database setup is not required for the current demo.** The mock API returns seeded project data and keeps create/update actions in memory. Demo data resets when the backend restarts. Prisma, the PostgreSQL schema, migrations, and optional Docker Compose service remain in the repository for a future database-backed implementation; they are not used by the demo API.

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

The dashboard loads projects, quotations, expenses, materials, attendance, site visits, activity, feedback, and backup history from `GET /api/dashboard`.

- `GET /api/health` — mock API status; no database connection is made.
- `POST /api/auth/login` and `POST /api/auth/logout` — demo role sign-in and sign-out.
- `GET` and `POST /api/projects` — list and create demo projects.
- `POST /api/quotations` and `PATCH /api/quotations/:id` — create and respond to quotations.
- `GET` and `POST /api/expenses` — list and submit demo expenses.
- `POST /api/progress` — submit a demo progress update.
- `GET` and `POST /api/site-visits` — list and schedule demo site visits.
- `GET` and `POST /api/feedback` — list and submit demo client feedback.
- `POST /api/backups` — request a demo account backup.

These endpoints are an in-memory UI prototype, not production persistence or authentication. The demo sign-in only checks the seeded role-specific credentials and stores the selected user in browser local storage; it is not suitable for production or sensitive data. Restarting the backend resets all demo changes.
