# MoveForge

A chess opening trainer. Build repertoires from your own lines or imported PGNs,
learn them move by move, then keep them with spaced repetition.

## How it works

1. **Build** — create a repertoire (white or black), add variations by playing
   moves on the board, and annotate individual moves with comments.
2. **Learn** — a variation must be learned before it can be reviewed. Each move
   is demonstrated, optionally explained, then played back from memory. Finishing
   a learn run enrolls the variation's moves into the SRS at level 1.
3. **Review** — due lines are replayed from the user's side. A move recalled on
   the first try is promoted one level; a miss resets it to level 1.

Only your own moves are review cards — in a white repertoire the odd moves, in a
black one the even moves (`isUserMove` in [lib/srs.ts](lib/srs.ts)).

### Review ladder

A fixed 8-level ladder, Chessable-style. The level sets the interval until the
move is due again:

| Level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|-------|---|---|---|---|---|---|---|---|
| Due in | 4h | 1d | 3d | 1w | 2w | 1mo | 3mo | 6mo |

## Features

- Multi-user accounts (email + password), every page and API route guarded with
  per-resource ownership checks
- Repertoire and variation management, inline renaming, cascading deletes
- PGN import — variations are named after their opening moves when the PGN
  carries no headers
- Per-variation learned/new indicator, plus to-learn and due counts per repertoire
- Profile page: account management, study stats, and a GitHub-style review
  activity heatmap with streak (one entry per reviewed line, not per move)
- Light/dark theme toggle

## Tech stack

- **Next.js 16** (App Router, Turbopack) and **React 19**
- **NextAuth v5** with a credentials provider and JWT sessions, bcrypt hashes
- **Prisma 7** on **PostgreSQL**, via the `@prisma/adapter-pg` driver adapter
- **chess.js** for move legality, **react-chessboard** for the board
- **Stockfish.js** (WASM) in a Web Worker for live analysis — GPL-3.0, see
  [NOTICE.md](NOTICE.md)

## Getting started

Requirements: Node 20+, a running PostgreSQL instance.

```bash
npm install
```

Create a `.env` in the project root:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/moveforge"
AUTH_SECRET="<random string, e.g. `openssl rand -base64 32`>"
```

Apply the schema and start the dev server:

```bash
npx prisma migrate deploy
npm run dev
```

Open http://localhost:3000 and register an account.

## Scripts

| Script | Does |
|--------|------|
| `npm run dev` | Dev server on port 3000 |
| `npm run build` | `prisma generate` → `prisma migrate deploy` → `next build` |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |

Note that `build` applies migrations, so `DATABASE_URL` must be reachable at
build time — not only at runtime.

## Database

The schema lives in [prisma/schema.prisma](prisma/schema.prisma); Prisma reads
its connection URL from [prisma.config.ts](prisma.config.ts).

```
User ─┬─< Repertoire ──< Variation ──< Move ──– Review
      └─< ReviewLog
```

- **Move** — one ply: FEN, SAN, from/to square, order within the line, optional comment
- **Review** — SRS state for a single move (level, next/last review), 1:1 with Move
- **ReviewLog** — one row per completed review line; powers the heatmap

Every relation cascades on delete, so removing a repertoire cleans up its
variations, moves and reviews.

After changing the schema:

```bash
npx prisma migrate dev --name <what-changed>
```

Commit the generated folder under `prisma/migrations/`. Don't use `prisma db
push` — it applies changes without recording them and desynchronizes the
migration history.

## API

All routes require a session and verify that the resource belongs to the caller
([lib/ownership.ts](lib/ownership.ts)); otherwise they answer 401 or 404.

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/register` | POST | Create an account |
| `/api/auth/[...nextauth]` | GET POST | NextAuth handlers |
| `/api/account` | PATCH DELETE | Change password, delete account |
| `/api/repertoires` | POST DELETE | Create and delete repertoires |
| `/api/variations` | GET POST PATCH DELETE | Manage variations |
| `/api/variations/import` | POST | PGN import |
| `/api/moves` | GET POST PATCH DELETE | Manage moves and comments |
| `/api/learn` | POST | Enroll a variation's moves into the SRS at level 1 |
| `/api/review` | POST | Grade a single move |
| `/api/review/line` | POST | Log one heatmap entry for a completed line |

## Layout

```
app/
  api/                    route handlers (see table above)
  components/             hub, editor, trainer, review session, analysis panel
  hooks/
    useStockfish.ts       engine worker, one search at a time
  login/  register/       auth pages
  profile/                account and stats
  repertoires/            the repertoire list
  repertoire/[id]/        editor, and /review for a session
  page.tsx                landing hub
auth.ts                   NextAuth configuration
lib/
  prisma.ts               PrismaClient singleton (pg adapter)
  srs.ts                  level ladder and scheduler
  ownership.ts            per-resource ownership checks
  uci.ts                  engine scores and PV → SAN
prisma/                   schema and migrations
scripts/                  copy-stockfish.mjs (engine into public/)
```

## Deployment

Set `DATABASE_URL` and `AUTH_SECRET` in the host's environment for both the
build and runtime phases. The build applies pending migrations itself, so a
fresh database is provisioned on first deploy.

`trustHost: true` is set in [auth.ts](auth.ts) for running behind a proxy.

The Stockfish engine is not committed. It is downloaded by the `stockfish`
package's own postinstall and copied into `public/stockfish/` by
`scripts/copy-stockfish.mjs`, which runs on `postinstall`, `predev` and
`prebuild`. If that download is unavailable at build time the script warns and
skips rather than failing the build — the app still deploys, but the analysis
panel reports that the engine could not load.

## Licensing

MoveForge serves a GPL-3.0 licensed chess engine to the browser. See
[NOTICE.md](NOTICE.md) for what is bundled, where it comes from, and what that
obliges.
