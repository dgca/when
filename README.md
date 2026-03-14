# When

A lightweight scheduling app for small groups. No accounts, no login — just share a link.

## Quick start

```bash
pnpm install
pnpm dev
```

Open http://localhost:5173

## How it works

1. Create a plan with time options
2. Share the participant link with your group
3. Everyone marks which times work
4. See results instantly

## Project structure

| Directory | Description |
|-----------|-------------|
| `projects/shared` | Zod schemas, types, API contracts |
| `projects/server` | Hono API with SQLite/Drizzle |
| `projects/web` | React + TanStack Router/Query + Tosui UI |

## Development

The server runs on port 3456 and the web client on port 5173. Vite proxies `/api` requests to the server.

Local SQLite database is auto-created at `projects/server/data/when.db`.

## Deployment

Hosted on [Railway](https://railway.com) with [Turso](https://turso.tech) as the database.

- **URL**: https://when.typeof.cool
- Pushes to `main` auto-deploy via Railway's GitHub integration
- Env vars (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`) are configured in Railway
