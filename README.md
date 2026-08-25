# Binance Trading Dashboard

Next.js dashboard for **paper trading** USDT pairs on Binance spot data. A scheduled strategy scans hourly candles, simulates buys/sells against a virtual cash balance, and records trades, positions, and equity in Postgres.

> **Disclaimer:** This project is for education and experimentation only. It does not place real orders on Binance and is not financial advice. Use at your own risk.

**Primary runtime:** local Next.js + Docker Postgres with an in-process hourly Strategy scheduler. Keep the machine awake (or accept missed H1 candles — the runner evaluates the latest closed candle only, not a full catch-up walk).

## Features

- Portfolio summary, open positions, trade history, and equity curve
- Symbol list with price chart (Recharts) and manual position close from the UI
- Automated strategy (hourly interval) with configurable rules in `constants/binance.ts`
- Portfolio-level drawdown cap: liquidates all open positions when equity falls 15% below peak while exposed
- Post-close 24h metrics on SELL trades (max/min price and % move after exit)
- Start/stop scheduler from the UI (`pnpm dev`)
- Scheduler health alerts when runs look stale or never recorded after start
- Optional web push notifications when trades execute
- In-process hourly scheduler (default); optional manual HTTP trigger via `pnpm cron:trigger`
- Historical backtest runner with kline cache and JSON reports
- Local ML pipeline: dataset generation, logistic-regression training (TensorFlow.js), evaluation, and strategy-parameter optimization

## Strategy

The strategy evaluates once per closed hourly candle (`H1`) and uses close prices for decisions. Core logic lives in `helpers/strategy/decision-core.ts`.

- **Entry**:
  - Current close and highest close in the 24h lookback must both be +40% to +60% above the lowest close (`ENTRY_RANGE_PCT = 0.4`, `ENTRY_RANGE_MAX_PCT = 0.6`)
  - Position size is 5% of available cash (`BUY_NOTIONAL_PCT = 0.05`)
  - Optional ML gate: when a trained model is wired in, BUY requires `entryProbability >= modelMinProbability`

- **Exit**:
  - 25% trailing stop (`TRAILING_STOP_PCT = 0.25`) measured from peak price since buy
  - 15% max loss per trade (`MAX_LOSS_PCT = 0.15`)

- **Portfolio drawdown cap**:
  - While any position is open, tracks peak equity (`exposure_peak_equity` in `strategy_meta`)
  - If equity drops 15% below that peak, all open positions are liquidated

- **Re-entry cooldown**:
  - Symbol cooldown after sell is 24h (`SYMBOL_REENTRY_COOLDOWN_MS`)

Default parameters are centralized in `constants/strategy-params.ts` as `DEFAULT_STRATEGY_PARAMS`.

## Stack

- [Next.js](https://nextjs.org/) 16 (App Router), React 19, Tailwind CSS 4
- [Drizzle ORM](https://orm.drizzle.team/) + Postgres via [postgres.js](https://github.com/porsager/postgres) (Docker Compose locally)
- Binance public market data (`data-api.binance.vision` by default)
- [Recharts](https://recharts.org/) for dashboard charts
- [TensorFlow.js](https://www.tensorflow.org/js) for local ML training (dev dependency)
- [Vitest](https://vitest.dev/) for unit tests
- [Playwright](https://playwright.dev/) for E2E smoke tests
- [Fallow](https://github.com/fallow-rs/fallow) for code-health audits in CI

## Project structure

```
app/                          Next.js App Router
├── page.tsx                  Dashboard entry
├── layout.tsx
├── globals.css
└── api/                      REST endpoints
    ├── portfolio/            Cash, equity, positions summary
    ├── trades/               Trade history
    ├── equity-curve/         Equity snapshots
    ├── klines/               Candle data for charts
    ├── closing-prices/       Batch closing prices
    ├── usdt-symbols/         Tradable USDT pairs
    ├── positions/close/      Manual position close
    ├── strategy/             start | stop | status
    ├── cron/run-strategy/    Manual HTTP trigger (protected by CRON_SECRET)
    ├── push/                 Web push subscribe/unsubscribe/VAPID key
    └── debug/zec-entry/      Local debug helper

components/                   React UI
├── dashboard/                Layout, strategy controls, cron alerts, data hooks
├── portfolio-summary.tsx
├── positions-table.tsx
├── trades-table.tsx
├── equity-curve.tsx
├── price-chart.tsx
├── base-area-chart.tsx
├── table-fetch-state.tsx
├── symbol-list.tsx
└── push-notification-toggle.tsx

e2e/                          Playwright smoke tests
├── fixtures/                 API mocks and test-id helpers
└── smoke/                    Dashboard happy path, loading, error states

.githooks/pre-push            Auto-bump package.json before push to main

helpers/                      Business logic
├── strategy/                 Runner, decision core, backtest, evaluate-symbol
├── scheduler/                In-process 5-minute heartbeat (hourly H1)
├── portfolio/                Portfolio API response builder
├── trades/                   Trade queries and metric backfills
├── equity-curve/             Snapshot queries
├── closing-prices/
├── notifications/            Web push delivery
└── ml/                       Dataset, training, evaluation, optimization

utils/                        Pure utilities
├── binance/                  Klines, symbols, caching, retries
├── strategy/                 Trailing stop, price conditions
├── ml/                       Features, labels, model I/O, artifact paths
├── trade/                    Post-close extrema
├── api/                      Cron auth, query parsing
├── scheduler/                Next run computation
└── notifications/            Push client helpers

constants/                    Strategy, Binance, ML, cron, layout, test-id config
types/                        Shared TypeScript types
db/                           Drizzle schema and postgres.js client
docker-compose.yml            Local Postgres 16
hooks/                        Dashboard layout and push UI hooks
scripts/                      CLI: backtest, ML, cron trigger, DB copy, local start, Windows startup, release
backtest-cache/               Local kline cache and ML artifacts (gitignored)
backtest-results/             Backtest JSON reports (gitignored)
public/sw.js                  Service worker for web push
```

## Prerequisites

- Node.js **≥ 20.9**
- [pnpm](https://pnpm.io/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for local Postgres)

## Local development

1. Clone the repo and install dependencies:

   ```bash
   pnpm install
   ```

2. Copy env template and start Postgres:

   ```bash
   cp .env.example .env.local
   docker compose up -d
   ```

   Or on Windows PowerShell, start Postgres + Next.js together:

   ```powershell
   pnpm start:local
   ```

   **Optional — start at Windows login:** run `.\scripts\install-startup.bat` once. It creates a Startup shortcut that opens a visible console and runs `scripts/start-local.ps1` after you sign in (Docker Postgres + `pnpm dev`). Enable Docker Desktop’s “Start when you sign in” so the daemon is up. Remove the shortcut with `.\scripts\uninstall-startup.bat`.

3. Push the schema:

   ```bash
   pnpm db:push
   ```

4. Start the dev server (if you did not use `pnpm start:local`):

   ```bash
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

`.env.example` defaults:

```env
DATABASE_URL=postgresql://trading:trading@localhost:5432/trading
AUTO_START_STRATEGY=true
```

`AUTO_START_STRATEGY=true` starts the in-process heartbeat inside the Next.js process via `instrumentation.ts`. It checks every 5 minutes (UTC-aligned) and runs the strategy on those ticks in the first 5 minutes of each hour. Restoring a persisted running scheduler does not run immediately. Use `pnpm dev` for Start/Stop controls in the UI (`pnpm start` runs with `NODE_ENV=production` and hides dashboard mutations).

**Uptime:** sleep/hibernate stops the heartbeat. Missed hours are not walked; the next run evaluates the latest closed H1 candle against `last_candle_H1`. On Windows, `.\scripts\install-startup.bat` relaunches the local server after sign-in.

`pnpm install` runs `prepare`, which points Git at `.githooks/`. The pre-push hook bumps `package.json` when you push to `main` (commit the bump, then push again).

### Migrate from Neon (or another Postgres)

1. Apply schema on the local DB (`pnpm db:push`).
2. Use Neon's **direct** `postgresql://` connection string (not HTTP/pooled-only).
3. Copy tables (preserves serial IDs; refuses a non-empty target unless `--force`):

   ```bash
   # Windows
   set SOURCE_DATABASE_URL=postgresql://...@...neon.tech/neondb?sslmode=require
   set TARGET_DATABASE_URL=postgresql://trading:trading@localhost:5432/trading
   pnpm db:copy

   # macOS / Linux
   export SOURCE_DATABASE_URL=postgresql://...@...neon.tech/neondb?sslmode=require
   export TARGET_DATABASE_URL=postgresql://trading:trading@localhost:5432/trading
   pnpm db:copy
   ```

4. Verify the dashboard locally, then pause/delete Neon and Railway in their dashboards so billing stops.

Web push endpoints copied from a public host may not work on `localhost` — re-subscribe if needed.

Locally, `pnpm start:local` or `pnpm push:setup` writes VAPID keys to `.env.local` if they are missing. `pnpm dev` also generates them on the first Enable click when they are still unset. Production still needs `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, and `WEB_PUSH_SUBJECT` set explicitly.

### Scripts

| Command                           | Description                                                    |
| --------------------------------- | -------------------------------------------------------------- |
| `pnpm start:local`                | Docker Postgres + `pnpm dev` (PowerShell helper)               |
| `.\scripts\install-startup.bat`   | Install Windows Startup shortcut for the local server          |
| `.\scripts\uninstall-startup.bat` | Remove the Windows Startup shortcut                            |
| `pnpm push:setup`                 | Generate web push VAPID keys into `.env.local` if missing      |
| `pnpm dev`                        | Next.js dev server                                             |
| `pnpm build`                      | Production build                                               |
| `pnpm start`                      | Production server                                              |
| `pnpm lint`                       | Run ESLint                                                     |
| `pnpm lint:fix`                   | Run ESLint with autofix                                        |
| `pnpm format`                     | Run Prettier                                                   |
| `pnpm test`                       | Run Vitest                                                     |
| `pnpm test:coverage`              | Vitest with coverage thresholds on `utils/` and `helpers/`     |
| `pnpm test:watch`                 | Vitest watch mode                                              |
| `pnpm test:e2e`                   | Playwright smoke tests (starts dev server)                     |
| `pnpm test:e2e:ui`                | Playwright UI mode                                             |
| `pnpm test:e2e:report`            | Open last Playwright HTML report                               |
| `pnpm backtest`                   | Run strategy backtest (localhost only)                         |
| `pnpm analyze:post-close`         | Analyze post-close 24h behavior                                |
| `pnpm backtest:cleanup`           | Remove old backtest reports                                    |
| `pnpm backtest:cache:cleanup`     | Remove backtest cache files                                    |
| `pnpm ml:dataset`                 | Generate ML training dataset from historical data              |
| `pnpm ml:train`                   | Train logistic-regression entry model                          |
| `pnpm ml:eval`                    | Evaluate model + strategy thresholds                           |
| `pnpm ml:optimize`                | Random-search strategy params with ML filter                   |
| `pnpm db:push`                    | Apply Drizzle schema to `DATABASE_URL`                         |
| `pnpm db:copy`                    | Copy tables from `SOURCE_DATABASE_URL` → `TARGET_DATABASE_URL` |
| `pnpm cron:trigger`               | Manually hit the strategy cron endpoint                        |
| `pnpm railway:up`                 | Optional rollback: deploy web via Railway CLI                  |
| `pnpm railway:up:web`             | Optional rollback: deploy web service                          |
| `pnpm railway:up:cron`            | Optional rollback: deploy cron service                         |
| `pnpm version:bump`               | Bump `package.json` patch ahead of latest tag                  |
| `pnpm version:check`              | Verify version is ready for release                            |
| `pnpm fallow:audit`               | Run Fallow code-health audit                                   |
| `pnpm fallow:dead-code`           | List likely dead code                                          |
| `pnpm fallow:dupes`               | List duplicate code                                            |
| `pnpm fallow:health`              | Fallow health summary                                          |

Backtest and ML scripts refuse to run when `NODE_ENV=production`.

### Backtest

Run a backtest and save a report under `backtest-results/`:

```bash
pnpm backtest --days 180
```

Klines are cached under `backtest-cache/` (or `BACKTEST_CACHE_DIR`). The simulator steps through closed `H1` candles and reuses the same decision core as live trading.

Analyze exit / trailing-stop scenarios on a specific report:

```bash
python scripts/analyze-backtest-exits.py backtest-results/backtest-<timestamp>.json
```

### ML pipeline (local)

ML artifacts are stored under `backtest-cache/ml/` (datasets, models, optimization runs).

```bash
# 1. Build labeled dataset from historical klines
pnpm ml:dataset --days 180

# 2. Train a logistic-regression model (uses latest dataset by default)
pnpm ml:train

# 3. Evaluate model thresholds against backtest splits
pnpm ml:eval --model-run-id <runId> --days 180

# 4. Random-search strategy params with optional ML probability gate
pnpm ml:optimize --model-run-id <runId> --days 180
```

Labels use a 24h forward horizon with a 15% max drawdown cap. Features include entry-band signals, range position, volatility, and time-of-day. See `constants/ml-strategy.ts` and `utils/ml/build-decision-features.ts`.

### Manual strategy trigger

Optional poke of `/api/cron/run-strategy` (still requires `CRON_SECRET` and `scheduler_running=true`):

```bash
# Windows
set CRON_URL=http://localhost:3000/api/cron/run-strategy
set CRON_SECRET=your-secret
pnpm cron:trigger

# macOS / Linux
export CRON_URL=http://localhost:3000/api/cron/run-strategy
export CRON_SECRET=your-secret
pnpm cron:trigger
```

## Scheduler

The supported path is the **in-process heartbeat** (5-minute UTC-aligned checks, hourly H1 evaluation):

| Env                        | Behavior                                                                |
| -------------------------- | ----------------------------------------------------------------------- |
| `AUTO_START_STRATEGY=true` | Heartbeat timer runs inside the Next.js server via `instrumentation.ts` |

Start/Stop from the dashboard (dev) flips `strategy_meta` and the in-memory timer. `/api/cron/run-strategy` remains a manual HTTP trigger only — not a second scheduler mode.

## Database schema

Postgres tables (see `db/schema.ts`):

| Table                | Purpose                                                 |
| -------------------- | ------------------------------------------------------- |
| `trades`             | BUY/SELL history, post-close 24h metrics                |
| `positions`          | Open paper positions                                    |
| `equity_snapshots`   | Periodic cash + equity snapshots                        |
| `strategy_meta`      | Last candle time, exposure peak equity, scheduler state |
| `push_subscriptions` | Web push endpoints                                      |

## Optional Railway rollback

`railway.json` and `railway.cron.json` remain in the repo for emergency redeploy. They are **not** the supported runtime. Prefer local Docker + in-process scheduling to avoid Railway and Neon billing.

If you redeploy:

1. Point `DATABASE_URL` at a Postgres wire URL (postgres.js — not Neon HTTP).
2. Prefer `AUTO_START_STRATEGY=true` on a always-on web process rather than the cron worker.
3. Pause unused Railway/Neon resources after you confirm local is healthy.

## CI and releases

[`.github/workflows/release.yml`](.github/workflows/release.yml) runs on every push and pull request to `main`.

### Quality gate (all PRs and pushes)

- Verify `package.json` version is ahead of the latest `v*` tag (`pnpm version:check`)
- `pnpm lint`
- `pnpm test:coverage` (Vitest with coverage thresholds on `utils/` and `helpers/`)
- `pnpm test:e2e` (Playwright smoke tests against a local dev server)
- `pnpm fallow audit --ci`

Coverage HTML is uploaded as a CI artifact on every run. Failed E2E runs upload the Playwright report.

### Versioning before merge

Releases tag whatever version is in `package.json` at merge time — CI does not bump it.

1. `pnpm install` enables `.githooks/pre-push`, which runs `pnpm version:bump` when you push to `main`.
2. If `package.json` changed, commit it (`chore: bump version`) and push again.
3. Or run `pnpm version:bump` manually before opening a PR.

First release requires `package.json` version `1.0.0`. Each subsequent release must be greater than the latest `v*` tag. Only stable `vMAJOR.MINOR.PATCH` tags are considered; pre-release tags (e.g. `v1.2.0-rc.1`) are ignored.

### Release (push to `main` only)

After the quality gate passes on a direct push to `main` (not on PRs):

1. Prepends commit messages since the last tag to [`CHANGELOG.md`](CHANGELOG.md)
2. Creates a `v*` git tag and [GitHub Release](https://github.com/razvantomegea/binance-trader/releases)
3. Attaches a coverage summary and downloadable HTML report (`coverage-report.zip`)

Bot commits (`chore(release): vX.Y.Z [skip release]`) are skipped to prevent release loops.

Railway deploy scripts remain available for optional rollback and are independent of releases.

## Environment reference

| Variable                     | Required            | Description                                      |
| ---------------------------- | ------------------- | ------------------------------------------------ |
| `DATABASE_URL`               | Yes                 | Postgres wire URL (`postgresql://…`)             |
| `AUTO_START_STRATEGY`        | Recommended locally | `true` to start in-process hourly scheduler      |
| `CRON_SECRET`                | For `cron:trigger`  | Protects `/api/cron/run-strategy`                |
| `CRON_URL`                   | For `cron:trigger`  | Full URL to `run-strategy`                       |
| `SOURCE_DATABASE_URL`        | For `pnpm db:copy`  | Source Postgres (e.g. Neon direct)               |
| `TARGET_DATABASE_URL`        | For `pnpm db:copy`  | Target Postgres (local Docker)                   |
| `BINANCE_API_BASE_URL`       | No                  | Defaults to `https://data-api.binance.vision`    |
| `BACKTEST_CACHE_DIR`         | No                  | Kline + ML cache root (default `backtest-cache`) |
| `WEB_PUSH_VAPID_PUBLIC_KEY`  | No                  | Web push public key (auto-generated locally)     |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | No                  | Web push private key (auto-generated locally)    |
| `WEB_PUSH_SUBJECT`           | No                  | `mailto:` or `https:` contact for VAPID          |

## License

No license file is included yet. If you fork or reuse this code, add a license that fits your intent.
