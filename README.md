# Binance Trading Dashboard

Next.js app for paper trading and strategy automation.

## Local Development

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Deployment

Production is deployed on Railway.

```bash
pnpm deploy:railway
```

### Scheduler mode

Scheduler behavior is controlled by `SCHEDULER_MODE`.

- `external-cron`: treat deployment as external/serverless cron mode.
- empty/unset: use default in-process scheduler mode.

This matches the runtime check in `helpers/scheduler/strategy-scheduler-meta.ts`:
`process.env.SCHEDULER_MODE === "external-cron"`.

For Railway, set a service variable:

- `SCHEDULER_MODE=external-cron`
