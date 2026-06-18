# ☀️ Solana Energy — Live Sales Metrics Dashboard

A live dashboard that reads the **Solana Energy Monday.com CRM** and renders the
Lead Gen & Sales Rep metrics defined in the *Lead-to-Sale Workflow* manual,
filtered by timeframe, with totals, conversion rates, a pipeline chart and a
per-person leaderboard.

```
Virtual Call Centre  ──►  Sales Funnel  ──►  Installations In Progress
   (lead assigned)         (booked / sat)        (sold deal → ops)
```

---

## Architecture

| Layer | Stack | Role |
|---|---|---|
| **Backend** (`/server`) | Node + Express | Pulls all 3 boards from the Monday API into an in-memory cache, auto-refreshes on an interval, and computes every metric on request. |
| **Frontend** (`/web`) | React + Vite + Recharts | Dashboard UI: role tabs, timeframe filters, KPI cards, conversion bars, pipeline chart, leaderboard. Polls the API every 60s. |

The backend caches board data so the UI is fast and the Monday API isn't hit on
every click. Because an item physically lives in **one** board at a time (it
moves VCC → Sales Funnel → Installations), summing a metric across boards never
double-counts a lead.

---

## Quick start

```bash
# 1. Install
npm install

# 2. Configure your Monday token
cp .env.example server/.env
#   then edit server/.env and set MONDAY_API_TOKEN

# 3a. Dev (API on :4000, hot-reloading UI on :5173)
npm run dev

# 3b. Production (build UI, serve everything from the API on :4000)
npm run build
npm start         # open http://localhost:4000
```

### Getting a Monday API token
In Monday: **avatar ▸ Developers ▸ My Access Tokens**, or **Admin ▸ API**.
The token needs **read** access to the three CRM boards. Put it in
`server/.env` as `MONDAY_API_TOKEN`. It is only ever used server-side and is
never exposed to the browser.

---

## Deployment

The Express server serves the built React app, so the whole dashboard runs as a
single service/container on one port.

### Docker (recommended)
```bash
# 1. Put your token in a .env file next to docker-compose.yml
echo "MONDAY_API_TOKEN=your_token_here" > .env

# 2. Build + run
docker compose up -d --build

# 3. Open http://localhost:4000  (logs: docker compose logs -f)
```
The image is multi-stage (builds the frontend, runs the API) and includes a
`/api/health` healthcheck. Override `DASHBOARD_TIMEZONE`,
`REFRESH_INTERVAL_SECONDS`, `TARGET_SOLD_MONTHLY`, `TARGET_REVENUE_MONTHLY` in
`.env` as needed.

### Without Docker (any Node 22 host)
```bash
npm install
npm run build          # outputs web/dist
MONDAY_API_TOKEN=... npm start   # serves API + UI on PORT (default 4000)
```
Run it behind a reverse proxy (Nginx/Caddy) for TLS, or on a PaaS (Render,
Railway, Fly.io, a small VM). Set the env vars in the platform's dashboard.

> **Platform notes:** Vercel/Netlify are static-only and won't run the cached
> backend cleanly — prefer a container/Node host (Render, Railway, Fly.io, VM)
> so the server-side Monday token stays private and the cache/refresh loop runs.

## Configuration (`server/.env`)

| Variable | Default | Meaning |
|---|---|---|
| `MONDAY_API_TOKEN` | — | **Required.** Monday API v2 token. |
| `PORT` | `4000` | API + dashboard port. |
| `REFRESH_INTERVAL_SECONDS` | `300` | How often the cache re-pulls from Monday. |
| `DASHBOARD_TIMEZONE` | `Australia/Sydney` | Timezone for all timeframe boundaries. |
| `TARGET_SOLD_MONTHLY` | `20` | Default monthly team Sold target (editable in UI). |
| `TARGET_REVENUE_MONTHLY` | `400000` | Default monthly team Revenue target (editable in UI). |

---

## Metric definitions (as implemented)

All board, column and group IDs live in [`server/src/config.js`](server/src/config.js)
and were read directly from the live CRM.

### Quantity metrics — counted by each metric's **own date column**

| Metric | People column | Date column | Boards / filter |
|---|---|---|---|
| **LG Assigned** | Lead Gen | Assigned to LG | VCC + Sales Funnel + Installations |
| **LG Booked** | Lead Gen | Booked Date | Sales Funnel + Installations |
| **LG Sat** | Lead Gen | Appointment Date | Sales Funnel *(Post-Sat groups)* + Installations *(Sold Date filled)* |
| **LG Sold** | Lead Gen | Sold Date | Installations |
| **SR Assigned** | Sales Rep | Booked Date | Sales Funnel + Installations |
| **SR Sat** | Sales Rep | Appointment Date | Sales Funnel *(Post-Sat groups)* + Installations *(Sold Date filled)* |
| **SR Sold** | Sales Rep | Sold Date | Installations |

*Post-Sat groups* = Proposal Pending, Proposal Sent, Sale Pending, Sat Not Sold.
In Installations, only items with a **Sold Date** are Solana sales —
subcontracting jobs (no Sold Date) are excluded from Sat/Sold counts.

### Conversion metrics — counted by **Creation Log** cohort

Per the manual's "Static Batch Conversion" rule, every conversion filters both
numerator and denominator by **Creation Log** (not the quantity date columns),
keeping each ratio within one creation cohort.

**Lead Gen:** Assigned→Booked, Assigned→Sat, Assigned→Sold, Booked→Sat, Booked→Sold, Sat→Sold
**Sales Rep:** Assigned→Sat, Assigned→Sold, Booked→Sat, Booked→Sold, Sat→Sold

### Timeframes
Today · This Week (Mon-start) · This Month · This Quarter · This Six Months ·
This Year · All Time · Custom range (the manual's "Customer Date").

### Dashboard features
- KPI cards with **period-over-period deltas** (▲/▼ vs the previous equivalent
  period; "NEW" when there's no prior baseline).
- Conversion funnel, pipeline-by-person chart, ranked leaderboard.
- **Lead Source performance** (leads, sold, revenue, avg CPL, spend) + revenue
  donut.
- **CSV export** of the current role view (leaderboard + lead sources).
- Solana-branded UI (logo at `web/public/solana-mark.svg` — swap in the official
  SVG to replace the placeholder mark).

### Local preview without a token
`MOCK=1 npm start` serves the dashboard with realistic synthetic data (no Monday
token needed) — handy for design/screenshots.

---

## API

| Endpoint | Description |
|---|---|
| `GET /api/health` | Cache status, last sync, item counts, token configured? |
| `GET /api/meta` | Available timeframes + conversion labels. |
| `GET /api/metrics?timeframe=this_month` | Full metric payload (both roles). For `custom`, add `&from=YYYY-MM-DD&to=YYYY-MM-DD`. |
| `POST /api/refresh` | Force an immediate Monday re-sync. |

---

## Tests

```bash
npm test          # metric-engine unit tests (no Monday token needed)
```

The suite validates cross-board aggregation, Post-Sat / Sold-Date filtering,
subcontracting exclusion, conversion math, divide-by-zero handling, and
timeframe windowing against a synthetic dataset.

---

## Notes & decisions (confirmed)

1. **Attribution = Monday people columns.** A Lead Gen "owns" an item when they
   are in the **Lead Gen** people column; a Sales Rep "owns" it when they are in
   the **Sales Rep** people column. Every metric is grouped by these columns.
2. **SR "Assigned" uses Booked Date.** Per the manual, a Sales Rep's *Assigned*
   count is items where they sit in the Sales Rep column, dated by **Booked
   Date**. Consequently a rep's "Assigned→…" and "Booked→…" conversions are the
   same ratio by design.
3. **Installations "Sat" requires a Sold Date.** Installation items count as
   *Sat* only when **Sold Date** is filled (genuine Solana sales); no-Sold-Date
   items are subcontracting jobs and are excluded.
4. Week boundaries start **Monday**; quarters/halves are calendar-based.
