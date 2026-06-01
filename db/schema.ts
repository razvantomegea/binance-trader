import {
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const trades = pgTable("trades", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  qty: numeric("qty", { precision: 24, scale: 12 }).notNull(),
  price: numeric("price", { precision: 24, scale: 12 }).notNull(),
  maxPriceAfterBuy: numeric("max_price_after_buy", {
    precision: 24,
    scale: 12,
  }),
  maxPriceAfterClose24h: numeric("max_price_after_close_24h", {
    precision: 24,
    scale: 12,
  }),
  minPriceAfterClose24h: numeric("min_price_after_close_24h", {
    precision: 24,
    scale: 12,
  }),
  maxPriceAfterClose24hPct: numeric("max_price_after_close_24h_pct", {
    precision: 12,
    scale: 6,
  }),
  minPriceAfterClose24hPct: numeric("min_price_after_close_24h_pct", {
    precision: 12,
    scale: 6,
  }),
  postClose24hAttemptedAt: timestamp("post_close_24h_attempted_at", {
    withTimezone: true,
  }),
  notional: numeric("notional", { precision: 24, scale: 8 }).notNull(),
  interval: text("interval").notNull(),
  candleOpenTime: timestamp("candle_open_time", {
    withTimezone: true,
  }).notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const positions = pgTable("positions", {
  symbol: text("symbol").primaryKey(),
  qty: numeric("qty", { precision: 24, scale: 12 }).notNull(),
  buyPrice: numeric("buy_price", { precision: 24, scale: 12 }).notNull(),
  maxPriceAfterBuy: numeric("max_price_after_buy", {
    precision: 24,
    scale: 12,
  }),
  buyTime: timestamp("buy_time", { withTimezone: true }).notNull(),
  buyTradeId: integer("buy_trade_id")
    .references(() => trades.id, { onDelete: "restrict" })
    .notNull(),
});

export const equitySnapshots = pgTable("equity_snapshots", {
  id: serial("id").primaryKey(),
  ts: timestamp("ts", { withTimezone: true }).defaultNow().notNull(),
  cash: numeric("cash", { precision: 24, scale: 8 }).notNull(),
  equity: numeric("equity", { precision: 24, scale: 8 }).notNull(),
  interval: text("interval").notNull(),
});

export const strategyMeta = pgTable("strategy_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  endpoint: text("endpoint").primaryKey(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
