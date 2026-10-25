# Vanya BuildTrack

A starter application for tracking concrete construction projects. The repository is an npm-workspaces monorepo with a React + TypeScript frontend, an Express + TypeScript API, and PostgreSQL access through Prisma.

## Requirements

- Node.js 20.19+ or 22.12+
- npm
- Docker Desktop (for the local PostgreSQL service)

## Getting started

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Create the backend environment file:

   ```powershell
   Copy-Item backend/.env.example backend/.env
   ```

3. Start PostgreSQL:

   ```powershell
   npm run db:up
   ```

4. Generate the Prisma client and apply the initial migration:

   ```powershell
   npm run db:migrate
   ```

5. Start the frontend and API:

   ```powershell
   npm run dev
   ```

The frontend is available at http://localhost:5173 and the API at http://localhost:3001. The Vite dev server proxies `/api` requests to the API.

## Available commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the frontend and API in watch mode |
| `npm run build` | Build both workspaces |
| `npm run db:up` | Start the local PostgreSQL container |
| `npm run db:down` | Stop the local PostgreSQL container |
| `npm run db:migrate` | Generate the Prisma client and run development migrations |
| `npm run db:deploy` | Apply existing migrations in a deployment |
| `npm run db:studio` | Open Prisma Studio |

The API exposes `GET /api/health` for database connectivity and `GET /api/projects` for the project list. Add database settings by editing `backend/.env`; never commit the populated file.
