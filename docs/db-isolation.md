# Database isolation (T-05)

The fork has **its own** database. It never talks to the upstream production Neon project.

## What the fork uses

| Item        | Value                                                                                                          |
| ----------- | -------------------------------------------------------------------------------------------------------------- |
| Engine      | PostgreSQL 17.12 (Homebrew `postgresql@17`)                                                                    |
| Host / port | `127.0.0.1:55432` — loopback only, `listen_addresses=127.0.0.1`                                                |
| Database    | `dogechain_bubblemaps_dogeos`                                                                                  |
| Role        | `dogechain_app` (owner, `CREATEDB` for shadow databases)                                                       |
| Data dir    | `~/.local-pg/dogechain-bubblemaps-dogeos` (outside the repo by design)                                         |
| Log         | `~/.local-pg/dogechain-bubblemaps-dogeos.log`                                                                  |
| Connection  | `DATABASE_URL` in `.env.local` — **never printed, never committed**                                            |
| Prod host   | `ep-empty-bread-…-pooler.us-east-1.aws.neon.tech` — **inactive**, original line kept commented in `.env.local` |

Why not Neon: this machine has no Neon API key and no `neonctl`, so the card's local-Postgres
fallback was used. The production Neon tables are untouched.

## Everyday commands

```bash
npm run db:up             # start the cluster (not a brew service — it does not autostart)
npm run db:local:status   # is it up, and which database am I actually on?
npm run db:status         # prisma migrate status  (expect: "Database schema is up to date!")
npm run db:migrate        # prisma migrate deploy
npm run db:generate       # prisma generate (client)
npm run db:roundtrip      # write+read+update+delete proof against the fork DB, 9 checks
npm run db:down           # stop it
```

`db:status` / `db:migrate` go through `scripts/dogeos-verify/db-local.sh exec …`, which exports
`DATABASE_URL` from `.env.local` first — the Prisma CLI only auto-loads `.env`, not `.env.local`.

## Schema

`prisma/schema.prisma` was missing upstream even though `prisma/migrations/*` existed, so
`prisma migrate status` could not run. It now mirrors the three migrations exactly; drift is zero:

```bash
npx prisma migrate diff --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma --shadow-database-url <admin url>
# → No difference detected.
```

The migration journal is the source of truth — do not hand-edit `schema.prisma` into a shape the
migrations do not produce.

## Rules for anything that touches the database

1. Never put a connection string in code, a commit, a chat message, or a card. Host only.
2. Add schema changes as **new** migrations (`npx prisma migrate dev --name …`); never rewrite an
   applied migration — its checksum is in `_prisma_migrations`.
3. `@neondatabase/serverless` (used by `scripts/setup-*.js`) speaks Neon's HTTP protocol and cannot
   reach a local Postgres socket. Server-side handlers for local dev need `pg` / `postgres`.
4. `scripts/dogeos-verify/db-roundtrip.mjs` refuses to run against any non-loopback host, so it can
   never be pointed at production by accident.
