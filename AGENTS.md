# When — AI Agent Guide

## What is this?

When is a lightweight scheduling app for small groups. No auth — just share links.

## Architecture

Monorepo with pnpm workspaces:

- `projects/shared` — Zod schemas, TypeScript types, API contracts
- `projects/server` — Hono API server with SQLite (Drizzle ORM)
- `projects/web` — React client with TanStack Router/Query and Tosui UI

## Stack

- **Language**: TypeScript (strict)
- **Package manager**: pnpm
- **Server**: Hono + Drizzle ORM + better-sqlite3
- **Client**: Vite + React 18 + TanStack Router (file-based) + TanStack Query + Tosui
- **Validation**: Zod (shared between client/server)
- **IDs**: nanoid (12 chars)
- **Tokens**: crypto.randomBytes (32 bytes, hex)

## Commands

```bash
pnpm install        # install all dependencies
pnpm dev            # start server (port 3456) and web (port 5173) concurrently
pnpm build          # build all projects
pnpm test           # run tests
```

## Key design decisions

- No authentication — access is link-based (participant links and admin tokens)
- Results are visible immediately, before submitting a response
- Edit tokens stored in localStorage enable same-browser response editing
- SQLite for local dev, Turso for production
- Server auto-creates DB tables on startup
- Vite proxies /api to server in dev

## API routes

- `POST /api/plans` — create plan
- `GET /api/plans/:planId` — get plan
- `PATCH /api/plans/:planId` — update plan (admin, x-admin-token header)
- `POST /api/plans/:planId/close` — close plan (admin)
- `POST /api/plans/:planId/responses` — submit response
- `PUT /api/plans/:planId/responses/:responseId` — update response (x-edit-token header)
- `GET /api/plans/:planId/results` — get aggregated results

## URL structure

- `/` — create plan
- `/p/:planId` — participant view
- `/a/:planId?token=ADMIN_TOKEN` — admin view

## File conventions

- Routes live in `projects/web/src/routes/` (TanStack file-based routing)
- Server routes in `projects/server/src/routes/`
- Shared schemas in `projects/shared/src/schemas.ts`
- DB schema in `projects/server/src/db/schema.ts`

## After making changes

- Update this file if architecture changes
- Update relevant README files
- Run `pnpm dev` to verify everything works
