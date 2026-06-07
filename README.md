# Binance Trading Dashboard

Next.js dashboard for **paper trading** USDT pairs on Binance spot data. A scheduled strategy scans hourly candles, simulates buys/sells against a virtual cash balance, and records trades, positions, and equity in Postgres.

> **Disclaimer:** This project is for education and experimentation only. It does not place real orders on Binance and is not financial advice. Use at your own risk.

## Features

- Portfolio summary, open positions, trade history, and equity curve
- Symbol list with price chart (Recharts) and manual position close from the UI
- Automated strategy (hourly interval) with configurable rules in `constants/binance.ts`
- Portfolio-level drawdown cap: liquidates all open positions when equity falls 15% below peak while exposed
- Post-close 24h metrics on SELL trades (max/min price and % move after exit)
- Start/stop scheduler from the UI
- Cron health alerts when external scheduling looks stale or never ran after start
- Optional web push notifications when trades execute
- Production scheduling via Railway cron or in-process cron for local dev
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
- [Drizzle ORM](https://orm.drizzle.team/) + Postgres (e.g. [Neon](https://neon.tech/))
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
    ├── cron/run-strategy/    External cron trigger (protected)
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
├── scheduler/                In-process cron heartbeat
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
├── scheduler/                Next cron run computation
└── notifications/            Push client helpers

constants/                    Strategy, Binance, ML, cron, layout, test-id config
types/                        Shared TypeScript types
db/                           Drizzle schema and client
hooks/                        Dashboard layout and push UI hooks
scripts/                      CLI: backtest, ML, cron trigger, cleanup, Railway deploy, release
backtest-cache/               Local kline cache and ML artifacts (gitignored)
backtest-results/             Backtest JSON reports (gitignored)
public/sw.js                  Service worker for web push
```

## Prerequisites

- Node.js **≥ 20.9**
- [pnpm](https://pnpm.io/)
- A Postgres database URL

## Local development

1. Clone the repo and install dependencies:

   ```bash
   pnpm install
   ```

2. Create `.env.local` in the project root:

   ```env
   # Required
   DATABASE_URL=postgresql://...

   # Strategy scheduler (pick one approach)
   # A) In-process cron on `pnpm dev` / `pnpm start`:
   AUTO_START_STRATEGY=true
   # B) External cron (production-style); call /api/cron/run-strategy yourself:
   # SCHEDULER_MODE=external-cron
   # CRON_SECRET=generate-a-long-random-string

   # Optional — override Binance data API base URL
   # BINANCE_API_BASE_URL=https://data-api.binance.vision

   # Optional — backtest / ML cache directory (default: ./backtest-cache)
   # BACKTEST_CACHE_DIR=backtest-cache

   # Optional — web push (generate keys: npx web-push generate-vapid-keys)
   # WEB_PUSH_VAPID_PUBLIC_KEY=
   # WEB_PUSH_VAPID_PRIVATE_KEY=
   # WEB_PUSH_SUBJECT=mailto:you@example.com
   ```

3. Push the schema:

   ```bash
   pnpm db:push
   ```

4. Start the dev server:

   ```bash
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

`pnpm install` runs `prepare`, which points Git at `.githooks/`. The pre-push hook bumps `package.json` when you push to `main` (commit the bump, then push again).

### Scripts

| Command                       | Description                                                |
| ----------------------------- | ---------------------------------------------------------- |
| `pnpm dev`                    | Next.js dev server                                         |
| `pnpm build`                  | Production build                                           |
| `pnpm start`                  | Production server                                          |
| `pnpm lint`                   | Run ESLint                                                 |
| `pnpm lint:fix`               | Run ESLint with autofix                                    |
| `pnpm format`                 | Run Prettier                                               |
| `pnpm test`                   | Run Vitest                                                 |
| `pnpm test:coverage`          | Vitest with coverage thresholds on `utils/` and `helpers/` |
| `pnpm test:watch`             | Vitest watch mode                                          |
| `pnpm test:e2e`               | Playwright smoke tests (starts dev server)                 |
| `pnpm test:e2e:ui`            | Playwright UI mode                                         |
| `pnpm test:e2e:report`        | Open last Playwright HTML report                           |
| `pnpm backtest`               | Run strategy backtest (localhost only)                     |
| `pnpm analyze:post-close`     | Analyze post-close 24h behavior                            |
| `pnpm backtest:cleanup`       | Remove old backtest reports                                |
| `pnpm backtest:cache:cleanup` | Remove backtest cache files                                |
| `pnpm ml:dataset`             | Generate ML training dataset from historical data          |
| `pnpm ml:train`               | Train logistic-regression entry model                      |
| `pnpm ml:eval`                | Evaluate model + strategy thresholds                       |
| `pnpm ml:optimize`            | Random-search strategy params with ML filter               |
| `pnpm db:push`                | Apply Drizzle schema to `DATABASE_URL`                     |
| `pnpm cron:trigger`           | Manually hit the strategy cron endpoint                    |
| `pnpm railway:up`             | Deploy web service (alias for `railway:up:web`)            |
| `pnpm railway:up:web`         | Deploy web service via Railway CLI                         |
| `pnpm railway:up:cron`        | Deploy cron service via Railway CLI                        |
| `pnpm version:bump`           | Bump `package.json` patch ahead of latest tag              |
| `pnpm version:check`          | Verify version is ready for release                        |
| `pnpm fallow:audit`           | Run Fallow code-health audit                               |
| `pnpm fallow:dead-code`       | List likely dead code                                      |
| `pnpm fallow:dupes`           | List duplicate code                                        |
| `pnpm fallow:health`          | Fallow health summary                                      |

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

### Manual cron trigger (local)

When using `SCHEDULER_MODE=external-cron`:

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

## Deployment (Railway)

The repo includes two [Railway](https://railway.com) config files for a common two-service setup:

| Service (example name) | Role                                      | Config file         |
| ---------------------- | ----------------------------------------- | ------------------- |
| Web app                | Next.js dashboard (always on)             | `railway.json`      |
| Cron worker            | Calls the strategy API every 5 min, exits | `railway.cron.json` |

### Web service

1. Connect the GitHub repo and deploy with `railway.json`.
2. Set variables (minimum):
   - `DATABASE_URL` — Postgres connection string
   - `SCHEDULER_MODE` = `external-cron`
   - `CRON_SECRET` — long random string; required for `/api/cron/run-strategy`
3. Add optional web push variables if you use notifications.

Do **not** set `AUTO_START_STRATEGY=true` when using external cron (avoids duplicate schedulers).

### Cron service

1. Add a second service in the same Railway project, same repo/branch.
2. **Settings → Config-as-code** → `railway.cron.json` (schedule: `*/5 * * * *`).
3. Variables (reference the web service by name in your project):
   - `CRON_SECRET` = `${{<web-service>.CRON_SECRET}}`
   - `CRON_URL` = `https://${{<web-service>.RAILWAY_PUBLIC_DOMAIN}}/api/cron/run-strategy`

Alternatively set `CRON_URL` explicitly to your public app URL.

### Verify

- Cron deployment logs should show a successful strategy run.
- On the dashboard, **Last run** updates after a successful trigger.

## Scheduler modes

| Mode       | Env                                            | Behavior                                                                   |
| ---------- | ---------------------------------------------- | -------------------------------------------------------------------------- |
| In-process | `AUTO_START_STRATEGY=true`                     | Heartbeat timer runs inside the Next.js server via `instrumentation.ts`    |
| External   | `SCHEDULER_MODE=external-cron` + `CRON_SECRET` | Strategy runs only when `/api/cron/run-strategy` is called with the secret |

## Database schema

Postgres tables (see `db/schema.ts`):

| Table                | Purpose                                                 |
| -------------------- | ------------------------------------------------------- |
| `trades`             | BUY/SELL history, post-close 24h metrics                |
| `positions`          | Open paper positions                                    |
| `equity_snapshots`   | Periodic cash + equity snapshots                        |
| `strategy_meta`      | Last candle time, exposure peak equity, scheduler state |
| `push_subscriptions` | Web push endpoints                                      |

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

First release requires `package.json` version `1.0.0`. Each subsequent release must be greater than the latest `v*` tag.

### Release (push to `main` only)

After the quality gate passes on a direct push to `main` (not on PRs):

1. Prepends commit messages since the last tag to [`CHANGELOG.md`](CHANGELOG.md)
2. Creates a `v*` git tag and [GitHub Release](https://github.com/razvantomegea/binance-trader/releases)
3. Attaches a coverage summary and downloadable HTML report (`coverage-report.zip`)

Bot commits (`chore(release): vX.Y.Z [skip release]`) are skipped to prevent release loops.

Railway deploy (`pnpm railway:up:web` / `pnpm railway:up:cron`) is manual and independent of releases.

## Environment reference

| Variable                     | Required          | Description                                      |
| ---------------------------- | ----------------- | ------------------------------------------------ |
| `DATABASE_URL`               | Yes               | Postgres connection string                       |
| `CRON_SECRET`                | For external cron | Protects `/api/cron/run-strategy`                |
| `SCHEDULER_MODE`             | Production        | Set to `external-cron` with Railway cron         |
| `AUTO_START_STRATEGY`        | Local optional    | `true` to start in-process scheduler             |
| `BINANCE_API_BASE_URL`       | No                | Defaults to `https://data-api.binance.vision`    |
| `BACKTEST_CACHE_DIR`         | No                | Kline + ML cache root (default `backtest-cache`) |
| `WEB_PUSH_VAPID_PUBLIC_KEY`  | No                | Web push public key                              |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | No                | Web push private key                             |
| `WEB_PUSH_SUBJECT`           | No                | `mailto:` or `https:` contact for VAPID          |
| `CRON_URL`                   | Cron worker only  | Full URL to `run-strategy` (cron service)        |

## License

No license file is included yet. If you fork or reuse this code, add a license that fits your intent.
