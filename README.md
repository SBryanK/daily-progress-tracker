# Daily Progress Tracker

A personal daily work progress tracker that replaces your Excel file. Responsive
web app, accessible from desktop, mobile, tablet. Built with **Next.js 15 +
Prisma + SQLite + NextAuth**. Zero external services required for local dev.

---

## What it does

- **Public-by-default** — anyone can open the landing page, dashboard,
  progress history, calendar and AI-summary page. No login wall.
- **Hidden sign-in** — a discreet "Sign in" button in the top-right corner
  opens a modal dialog. Only pre-authorized emails (listed in
  `ADMIN_EMAILS`) can sign in; there is **no** public sign-up.
- **Add / edit / delete** daily progress entries (date, time range, project,
  task, status, priority, blockers, next action, links, tags, remarks) —
  admin only.
- **Dashboard** — today & this week at-a-glance, blockers, pending actions,
  top projects.
- **History table** — search, filter by date range / project / status /
  priority / category, paginate.
- **Calendar** — monthly grid view, click a day → see all entries.
- **Import Excel** — upload your existing tracker (`.xlsx`). Both template
  styles in your real workbook are supported (old column-per-person layout
  **and** new time-sliced layout), with live preview before commit and
  fingerprint-based deduplication on re-import.
- **Export** — download filtered progress as Excel / CSV / PDF.
- **Share links** — generate unguessable read-only URLs for your manager,
  scoped by date / project / status, with optional expiry, revocable any
  time.
- **AI summary** — daily / weekly / monthly / manager-ready report.
  Uses OpenAI or Anthropic if `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` is
  set, otherwise falls back to a deterministic built-in summariser (works
  offline).
- **Multi-admin auth** — NextAuth v5 credentials provider, comma-separated
  `ADMIN_EMAILS`. All mutating API routes enforce admin role on the backend.
- **Dark mode** — system-aware, manual toggle, no FOUC.
- **A11y** — WCAG AA contrast, labels on every input, focus-visible on every
  interactive element, `prefers-reduced-motion` respected.

---

## Daily template (May 2026 onwards)

From **2026-05-13** onwards, Bryan logs daily notes in a structured template
instead of hour-by-hour blocks. Existing legacy days remain unchanged — the
journal renders them with the original time-blocked card; new days render
with the structured card.

```
[YYYY-MM-DD]

Work log:
  09:00 — …
  12:00 — …
  15:00 — …
  18:00 — …

Top Things:
  - …
  - …

Completed    (each item optionally chip-linked to a Top Thing or assoc)
Progressing  (same shape)
Tomorrow     (same shape)
```

Schema (additive, zero-downtime migration
`prisma/migrations/20260516000000_add_structured_entries`):

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `entryKind`  | `text`  | `'LEGACY'` | `LEGACY` \| `STRUCTURED` |
| `structured` | `jsonb` | `NULL`     | The full template payload |

Legacy `description`, `startTime`, `endTime`, etc. stay populated for every
row so existing exports, AI summaries and share links keep working
untouched. For structured entries the server projects the template into a
plain-text `description` automatically.

The **owner composer** lives on the homepage (`/`):

- Pre-fills today's date in `Asia/Jakarta` wall-clock.
- Edit-mode hydrates from today's existing structured entry if any.
- `⌘ / Ctrl + Enter` saves without leaving the page.
- Once today exists, a **+ Add to Work log** quick row appends a single
  `{ time, note }` chronologically via
  `POST /api/progress/{id}/append-worklog`.

## Welcome flow (Owner vs. Visitor gate)

First-time browsers land on `/welcome` and choose between two cards:

```
┌──────────────────────────┐  ┌──────────────────────────┐
│ I'm the Owner (Bryan)    │  │ I'm a Visitor            │
│ → /login (NextAuth)      │  │ → set dpt.role=visitor   │
│ → set dpt.role=owner     │  │   (1 year)               │
│   on successful sign-in  │  │                          │
└──────────────────────────┘  └──────────────────────────┘
```

The `dpt.role` cookie is `Max-Age=31536000`, `SameSite=Lax`, `Path=/`. The
`src/middleware.ts` welcome-gate layer reads it; routes in the bypass
allowlist (`/welcome`, `/login`, `/api/*`, `/share/*`, static) skip the
redirect.

- The footer's **Switch role** link clears the cookie via
  `GET /api/welcome/switch-role` and redirects back to `/welcome`.
- A signed-in browser without `dpt.role` (e.g. an existing Bryan device on
  first visit after the upgrade) is gated exactly once, then remembered.
- Authorisation is **never** based on the cookie alone — the cookie is a
  UX-only "remembered choice". NextAuth + middleware continue to enforce
  every write.

---

## 1. Quickstart (local)

Requires Node.js 20+ and npm.

```bash
cd apps/daily-progress-tracker

# 1. Copy & edit environment
cp .env.example .env
# Set a strong AUTH_SECRET:
# openssl rand -base64 32
# Paste it into AUTH_SECRET in .env
# Then configure ADMIN_EMAILS="you@example.com,boss@example.com"
# and ADMIN_PASSWORD="..." for the seeded admins.

# 2. Install dependencies
npm install

# 3. Create the SQLite DB and run migrations
npx prisma migrate dev --name init

# 4. Seed the admin users (multi-admin via ADMIN_EMAILS)
npm run db:seed

# 5. (Optional) If you already imported Excel data under a different admin,
#    reassign every row to the new primary admin:
npm run db:reassign-owner

# 6. Start the dev server
npm run dev
```

Open <http://localhost:3000> → sign in with the seeded credentials
(default: `bryan@local.test / ChangeMe!123` — change in `.env`).

---

## 2. Import your existing Excel tracker

Two options — both work on the real file at
`bryan/Bryan's+Daily+Progress+2025-2026+(Intern).xlsx`:

### Option A — via the web UI (recommended)

1. Sign in → left sidebar → **Import Excel**
2. Choose the `.xlsx` file → **Preview**
3. Inspect the detected template per sheet (old / new / unknown) and the
   parsed entries
4. Click **Confirm import**. Duplicates are skipped automatically on
   re-import thanks to the fingerprint on `(date, startTime, taskTitle,
   description)`.

### Option B — via the CLI

```bash
npm run import:excel -- "/absolute/path/to/Bryan's+Daily+Progress+2025-2026+(Intern).xlsx"
```

The parser handles **both** templates that your workbook contains
(verified by direct inspection of the file):

| Template | Sheets | Layout |
|----------|--------|--------|
| OLD (column-per-person) | `JuneJuly 2025`, `August 2025` … `January 2026`, `March 2026 (old)` | Week · Day · Bryan[To-do, Progress] · Mr. Sam[…] · Mr. Dexmond[…] · Mr. Wilson[…] |
| NEW (time-sliced) | `February 2026 (New Template)`, `March 2026`, `April 2026`, `May 2026`, `June 2026` | Week · Day · From · To · Activity · Notes · Progress · Task · Team task · Progress |

Each imported row retains its `sourceSheet` + `sourceRow` in the database
so you can trace any entry back to the original Excel cell.

---

## 3. Sharing a report with your manager

1. **Share links** in the sidebar.
2. Give it a label, pick a date range / project / status, and an optional
   expiry (defaults to 30 days).
3. Click **Copy** → send the URL. The page is public (no login required)
   but the token is unguessable (24-byte random hex) and can be revoked.

---

## 4. AI summary

1. **AI summary** in the sidebar.
2. Pick kind (Daily / Weekly / Monthly / Manager report) and optional
   date range.
3. Hit **Generate**.

Without any API key, it uses a deterministic built-in summariser that
produces structured markdown (At-a-glance / By project / By status /
Key accomplishments / Blockers / Next steps).

To turn on LLM-backed summaries, set **one** of:

```env
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4o-mini"       # optional
# or
ANTHROPIC_API_KEY="sk-ant-..."
ANTHROPIC_MODEL="claude-3-5-haiku-latest"   # optional
```

Failures transparently fall back to the deterministic summariser.

---

## 5. Architecture

```
┌─────────────────┐      ┌────────────────────────────┐
│  Browser        │─────▶│  Next.js 15 (App Router)    │
│  (desktop/mobile)│     │  ├─ React Server Components │
└─────────────────┘      │  ├─ API routes              │
                         │  │   /api/auth/[...nextauth]│
                         │  │   /api/progress          │
                         │  │   /api/import            │
                         │  │   /api/export            │
                         │  │   /api/share             │
                         │  │   /api/summary           │
                         │  │   /api/health            │
                         │  └─ Middleware (auth guard) │
                         └───────────┬────────────────┘
                                     │ Prisma
                                     ▼
                         ┌────────────────────────────┐
                         │  SQLite (dev)              │
                         │  or Postgres/Turso (prod)  │
                         └────────────────────────────┘
```

### Directory layout

```
apps/daily-progress-tracker/
├── prisma/
│   ├── schema.prisma           # User, ProgressEntry, Comment, ImportBatch, ShareLink
│   └── seed.ts                 # Admin seed
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout + Inter font + no-FOUC theme
│   │   ├── page.tsx            # Redirect → /dashboard or /login
│   │   ├── globals.css         # Semantic CSS variables (light + dark)
│   │   ├── login/page.tsx      # Credentials sign-in
│   │   ├── (app)/              # Route group — all require auth
│   │   │   ├── layout.tsx      # Auth guard + AppShell
│   │   │   ├── dashboard/
│   │   │   ├── progress/
│   │   │   ├── calendar/
│   │   │   ├── import/
│   │   │   ├── export/
│   │   │   ├── share/
│   │   │   └── summary/
│   │   ├── share/[token]/page.tsx   # Public read-only report
│   │   └── api/*                # REST endpoints
│   ├── components/
│   │   ├── ui/                  # Button, Input, Card, Badge
│   │   ├── app-shell.tsx        # Sidebar + mobile top bar
│   │   ├── entry-form.tsx       # Create/edit progress entry form
│   │   └── providers.tsx        # NextAuth SessionProvider
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── auth.ts              # NextAuth v5 credentials
│   │   ├── ai.ts                # Summary (OpenAI / Anthropic / fallback)
│   │   ├── excel.ts             # .xlsx parser for both templates
│   │   ├── constants.ts         # STATUS / PRIORITY enums
│   │   ├── validation.ts        # zod schemas
│   │   ├── logger.ts
│   │   └── utils.ts
│   └── middleware.ts            # Protects every route not in the public list
├── scripts/
│   └── import-excel.ts          # CLI import
├── .env.example
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── vercel.json
└── package.json
```

### Database schema

```
User (id, email, name, role, passwordHash, createdAt)
  ├─< ProgressEntry (id, userId, date, startTime, endTime, durationMinutes,
  │                  projectName, taskTitle, category, description,
  │                  status, priority, blockers, nextAction, remarks, tags,
  │                  relatedLinks, sourceSheet, sourceRow, importBatchId,
  │                  createdAt, updatedAt)
  │      └─< Comment (id, entryId, userId, body, resolved, createdAt)
  ├─< ImportBatch (id, userId, filename, totalRows, importedRows,
  │               skippedRows, notes, createdAt)
  └─< ShareLink (id, userId, token, label, fromDate, toDate, projectName,
                statusFilter, revoked, createdAt, expiresAt)
```

---

## 6. API reference

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET`  | `/api/health` | public | Health check |
| `*`    | `/api/auth/*` | public | NextAuth credentials endpoints |
| `GET`  | `/api/progress?limit=50` | required | List recent entries |
| `POST` | `/api/progress` | required | Create entry |
| `GET`  | `/api/progress/:id` | required | Get entry |
| `PATCH`| `/api/progress/:id` | required | Update entry |
| `DELETE`| `/api/progress/:id` | required | Delete entry |
| `POST` | `/api/import` (multipart `file`, `dryRun=true\|false`) | required | Preview / commit Excel import |
| `GET`  | `/api/export?format=xlsx\|csv\|json&from&to&project&status` | required | Export filtered data |
| `GET`  | `/api/share` | required | List share links |
| `POST` | `/api/share` | required | Create share link |
| `DELETE`| `/api/share/:id` | required | Revoke share link |
| `POST` | `/api/summary` `{kind, from?, to?}` | required | Generate AI summary |

---

## 7. Deploy

### Vercel (simplest)

For Vercel production you must swap SQLite for Postgres (or Turso), because
Vercel serverless functions have a read-only file system.

1. Create a free Postgres DB on **Neon** or **Supabase**, or a libSQL DB on
   **Turso**. Copy the connection URL.
2. In `prisma/schema.prisma`, change:

   ```prisma
   datasource db {
     provider = "postgresql" // or "sqlite" for Turso libSQL
     url      = env("DATABASE_URL")
   }
   ```

   For Turso, use the `@libsql/client` + `prisma-libsql` adapter — the
   schema itself stays SQLite.

3. `vercel` CLI: `vercel deploy --prod` (or connect the repo in the
   dashboard). Set these env vars in Vercel:

   | Var | Required | Notes |
   |-----|----------|-------|
   | `DATABASE_URL` | ✅ | From Neon / Supabase / Turso |
   | `AUTH_SECRET` | ✅ | `openssl rand -base64 32` |
   | `AUTH_TRUST_HOST` | ✅ | `true` |
   | `NEXT_PUBLIC_APP_URL` | ✅ | `https://your-app.vercel.app` |
   | `SEED_ADMIN_EMAIL` | ✅ | Your email |
   | `SEED_ADMIN_PASSWORD` | ✅ | Strong password |
   | `OPENAI_API_KEY` | optional | Enables OpenAI summaries |
   | `ANTHROPIC_API_KEY` | optional | Enables Anthropic summaries |

4. First deploy runs `prisma migrate deploy` automatically (via the
   `build` script). On first boot, run the seed:

   ```bash
   vercel env pull .env.production.local
   npx prisma db push --schema=prisma/schema.prisma
   npx tsx prisma/seed.ts
   ```

### Railway / Fly.io / self-hosted

A single Dockerfile (not included; `next start` + `prisma migrate deploy`)
is sufficient. Persistent volume for the SQLite file → it works fine for
one user.

---

## 8. Security notes

- All edit routes require a signed session cookie (NextAuth JWT).
- Share links use a 24-byte (48-hex-char) random token from the Web
  Crypto API — not guessable in practice. Revocation flips a flag,
  never deletes (fail-closed).
- Passwords hashed with bcrypt (10 rounds).
- `X-Content-Type-Options`, `X-Frame-Options: SAMEORIGIN`,
  `Referrer-Policy: strict-origin-when-cross-origin`, restrictive
  `Permissions-Policy` shipped via `vercel.json`.
- Inputs validated with zod on every API route; SQL injection is
  prevented by Prisma parameterization.
- No user input is rendered as HTML; React auto-escapes.

---

## 9. What is NOT in v1 (deliberate scope control)

- Multi-user RBAC (only Admin + read-only share links)
- Email / Slack / Teams notifications
- Manager comment threads (schema is ready — `Comment` model — but UI is v2)
- File attachments (schema hook exists; storage not wired)
- Google/Outlook calendar integration
- Natural language entry parsing (e.g. "Today 9-10:30 worked on X")

These are all tracked in `knowledge-base/learnings/FEATURE_REQUESTS.md`
of the project-creator skill and the schema already accommodates them.

---

## 10. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `prisma: command not found` | Run inside `apps/daily-progress-tracker/`, after `npm install` |
| `EACCES` on `prisma/dev.db` | `chmod 644 prisma/dev.db` or delete it and re-migrate |
| Import preview shows `UNKNOWN` template | The sheet doesn't match either detected pattern — check the column header row has either `Bryan` (old template) or `From / To / Activity` (new template) |
| Share link returns 404 | The link was revoked, or `expiresAt` passed. Generate a new one |
| AI summary returns the deterministic template even with `OPENAI_API_KEY` set | Check server logs: `ai.summary.provider_failed` means the upstream API failed; verify the key + billing |

---

## 11. Putting EdgeOne in front of a Tencent Cloud VM

You already run the Node server on a Tencent Cloud VM and have a domain
pointing at it. Here is the exact recipe to put Tencent EdgeOne in front
as the public-facing CDN + WAF. End result: users hit
`https://progress.yourdomain.com` (EdgeOne) → EdgeOne caches static +
proxies dynamic to `origin.yourdomain.com` (your VM).

### 11.1 Decide origin hostname

EdgeOne must reach your VM by hostname (not "the same domain as the
CDN"), otherwise you get a DNS loop. Two clean options:

- **Option A (recommended):** keep your existing domain (e.g.
  `progress.yourdomain.com`) as the **public CDN hostname**, and create
  a second DNS record like `origin.yourdomain.com` that points directly
  to the VM's public IP. EdgeOne is configured to use `origin.yourdomain.com`
  as the origin.
- **Option B:** use the VM's public IP as the origin directly.

Either way the VM must be reachable from EdgeOne's egress (open TCP 80 + 443
in the Tencent Cloud security group).

### 11.2 Prepare the VM (one-time)

```bash
# On the VM — assumes Ubuntu 22.04+
sudo apt update && sudo apt install -y nginx

# 1. Install Node 20 + pnpm if you haven't (nvm recommended)
# 2. Clone the repo and run:
cd /srv
git clone <your-repo> daily-progress
cd daily-progress/apps/daily-progress-tracker
cp .env.example .env
# edit .env — at minimum:
#   DATABASE_URL="file:./prisma/dev.db"      # OR a Postgres URL
#   AUTH_SECRET="$(openssl rand -base64 32)"
#   AUTH_TRUST_HOST="true"
#   NEXT_PUBLIC_APP_URL="https://progress.yourdomain.com"
#   ADMIN_EMAILS="you@example.com"
#   ADMIN_PASSWORD="..."

npm ci
npm run build           # prisma migrate deploy + next build
npm run db:seed

# 3. Run under systemd so it restarts on reboot
sudo tee /etc/systemd/system/progress.service >/dev/null <<'EOF'
[Unit]
Description=Daily Progress Tracker (Next.js)
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/srv/daily-progress/apps/daily-progress-tracker
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=/srv/daily-progress/apps/daily-progress-tracker/.env
ExecStart=/usr/bin/npm run start
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now progress

# 4. Nginx reverse-proxy (terminates HTTP on :80, forwards to Node on :3000)
sudo tee /etc/nginx/sites-available/progress >/dev/null <<'EOF'
server {
  listen 80;
  server_name origin.yourdomain.com;

  # EdgeOne-only access: uncomment after you've verified everything works.
  # (Only EdgeOne back-to-origin IPs should be allowed to hit :80 directly.)
  # allow <EdgeOne egress CIDR>;  # get the list from the EdgeOne console
  # deny all;

  client_max_body_size 20m;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host               $host;
    proxy_set_header X-Real-IP          $remote_addr;
    proxy_set_header X-Forwarded-For    $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto  $http_x_forwarded_proto;
    proxy_set_header X-Forwarded-Host   $http_x_forwarded_host;
    proxy_set_header Upgrade            $http_upgrade;
    proxy_set_header Connection         "upgrade";
    proxy_read_timeout 60s;
  }
}
EOF
sudo ln -sf /etc/nginx/sites-available/progress /etc/nginx/sites-enabled/progress
sudo nginx -t && sudo systemctl reload nginx
```

Verify `curl -I http://origin.yourdomain.com/api/health` on another box
returns `{"status":"ok"}`.

### 11.3 Configure EdgeOne

In the Tencent Cloud EdgeOne console
(<https://console.cloud.tencent.com/edgeone>):

1. **Add Site** → pick the apex domain you own (e.g. `yourdomain.com`).
   Follow the NS-change or CNAME-access wizard so EdgeOne becomes
   authoritative (or at least receives the acceleration traffic).
2. **Domain Services → Domain Management → Add Domain**
   - Acceleration domain: `progress.yourdomain.com`
   - Origin type: `Origin server` (source station)
   - Origin: `origin.yourdomain.com` (or the VM public IP)
   - Origin server port: `80` (HTTP)
   - Origin server protocol: `HTTP` (TLS is terminated at EdgeOne)
   - Host header: `progress.yourdomain.com` — **important**, Next.js uses
     this for absolute URLs.
3. **HTTPS configuration**
   - Apply a free Tencent-issued cert, or upload your own.
   - Force HTTPS: `ON` (auto-redirect HTTP → HTTPS).
   - TLS version: `TLS 1.2+` (disable TLS 1.0/1.1).
   - HSTS: `ON`, max-age = 15768000, `includeSubDomains` off initially.
4. **Cache configuration** — critical for a Next.js app. Add these rules
   **in order** (first match wins):

   | # | Match | Cache behaviour |
   |---|-------|-----------------|
   | 1 | Path = `/api/*`                              | **No cache** (bypass). Never cache API or auth callbacks. |
   | 2 | Path = `/_next/static/*`                     | Cache 365d, follow origin, ignore cookies, ignore query. |
   | 3 | Path = `/_next/image*`                       | Cache 7d, respect query string, ignore cookies. |
   | 4 | Extension in `css,js,woff2,woff,ttf,svg,png,jpg,jpeg,gif,webp,ico,map` | Cache 30d, ignore cookies. |
   | 5 | Default (all remaining paths)                | **No cache** (Next.js dynamic server-rendered pages). The signed-in session cookie must not leak between users. |

   Also set "**Ignore origin `Cache-Control`**" to **OFF** so `/_next/static/*`
   keeps its immutable `Cache-Control: public, max-age=31536000, immutable`.

5. **Cookie & query-string handling**
   - For rule #5 (default dynamic paths): forward **all cookies** and
     **all query strings** to origin (required for `authjs.session-token`).
   - For rule #1 (`/api/*`): same — forward everything, cache nothing.

6. **Origin request header rewrites** — pass the real scheme through so
   NextAuth doesn't generate `http://` callback URLs:
   - `X-Forwarded-Proto: https`
   - `X-Forwarded-Host: progress.yourdomain.com`
   EdgeOne adds these automatically in most setups; verify with
   `curl -I https://progress.yourdomain.com/ -H "Accept: text/html"` and
   check the server logs show `proto=https`.

7. **Security → Web Protection (WAF)**
   - Enable the **Managed Ruleset** → Normal mode (block).
   - Add a **Rate Limiter** on `/api/auth/callback/credentials` — e.g.
     10 req / minute per IP. Protects against credential stuffing.
   - Optionally enable **Bot Management** → challenge obvious crawlers.

8. **DNS cut-over**
   - Point `progress.yourdomain.com` CNAME to the EdgeOne-assigned CNAME
     (shown in the acceleration domain detail page, e.g.
     `progress.yourdomain.com.eo.dnse1.com`).
   - Keep `origin.yourdomain.com` as a plain A record pointing at the VM.

### 11.4 Adjust the app for being behind a proxy

Two env-var tweaks are enough:

```bash
# .env on the VM
AUTH_TRUST_HOST="true"                    # trust X-Forwarded-Host from EdgeOne
NEXT_PUBLIC_APP_URL="https://progress.yourdomain.com"
```

The code already reads `NEXT_PUBLIC_APP_URL` for absolute URLs (share
links) and NextAuth v5 respects `AUTH_TRUST_HOST`.

### 11.5 Smoke-test the end-to-end path

```bash
# 1. Health — should hit origin (no cache) and return JSON:
curl -sS https://progress.yourdomain.com/api/health

# 2. Public landing — 200:
curl -sS -o /dev/null -w "%{http_code}\n" https://progress.yourdomain.com/

# 3. Private route anon — must 307 to /?signin=1:
curl -sS -o /dev/null -w "%{http_code} %{redirect_url}\n" \
     https://progress.yourdomain.com/progress/new

# 4. Static asset — should come back with a 31536000 cache header and
#    "EO-Cache-Status: HIT" (or similar) after the first request:
curl -sI https://progress.yourdomain.com/_next/static/chunks/main-*.js
```

### 11.6 Ongoing operations

- **Deploy a new version:** `git pull && npm ci && npm run build &&
  sudo systemctl restart progress` on the VM. EdgeOne will auto-serve
  the updated HTML on the next request (default rule #5 is "no cache").
  Static assets get new hashes per build so the old ones can sit in cache
  forever without staleness.
- **Force-purge after a hotfix:** EdgeOne → Cache Management → Purge
  URL → paste `https://progress.yourdomain.com/*` (or individual URLs).
  Purges are usually effective globally within ~60s.
- **Monitor:** EdgeOne → Monitoring → Traffic + Error rate; your VM →
  `journalctl -fu progress`.

### 11.7 Things to avoid

- **Do not** cache anything that sets `Set-Cookie`. The middleware + auth
  layer relies on cookies being unique per user. The default "no cache"
  on dynamic paths handles this automatically.
- **Do not** terminate TLS only at Nginx (on the VM) while EdgeOne is also
  HTTPS — you end up double-encrypted. Use `HTTP` between EdgeOne and the
  VM origin; EdgeOne gives you HTTPS for end users.
- **Do not** forget to allowlist the EdgeOne back-to-origin IP ranges
  once you're confident the setup works — published in the EdgeOne docs,
  and puts a hard stop on anyone bypassing EdgeOne by hitting the VM IP
  directly.

---
