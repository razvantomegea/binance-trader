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
  buyTime: timestamp("buy_time", { withTimezone: true }).notNull(),
  buyTradeId: integer("buy_trade_id").notNull(),
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
