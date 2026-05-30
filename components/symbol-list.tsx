"use client";

import clsx from "clsx";
import { useMemo, useState } from "react";

import { MOBILE_DASHBOARD_PANEL_FIXED_HEIGHT_CLASS_NAME } from "@/constants/dashboard-layout";

interface SymbolRow {
  symbol: string;
  close: string | null;
}

interface SymbolListProps {
  symbols: SymbolRow[];
  selectedSymbol: string;
  onSelect: (symbol: string) => void;
  loading: boolean;
}

export function SymbolList({
  symbols,
  selectedSymbol,
  onSelect,
  loading,
}: SymbolListProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toUpperCase();
    if (!normalized) {
      return symbols;
    }
    return symbols.filter((row) => row.symbol.includes(normalized));
  }, [query, symbols]);

  return (
    <div
      className={clsx(
        "flex min-h-0 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 lg:absolute lg:inset-y-0 lg:left-0 lg:z-10 lg:max-h-none lg:w-72 xl:w-80",
        MOBILE_DASHBOARD_PANEL_FIXED_HEIGHT_CLASS_NAME,
      )}
    >
      <div className="shrink-0 border-b border-zinc-200 p-3 dark:border-zinc-800">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search symbol..."
          className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-base outline-none focus:border-zinc-400 sm:text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && symbols.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">Loading symbols...</p>
        ) : (
          <ul>
            {filtered.map((row) => {
              return (
                <li key={row.symbol}>
                  <button
                    type="button"
                    onClick={() => onSelect(row.symbol)}
                    className={clsx(
                      "flex w-full items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2 text-left text-sm transition-colors dark:border-zinc-900",
                      selectedSymbol === row.symbol
                        ? "bg-zinc-100 dark:bg-zinc-900"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-900/60",
                    )}
                  >
                    <span className="min-w-0 shrink truncate font-medium">
                      {row.symbol}
                    </span>
                    <span className="shrink-0 text-right tabular-nums text-zinc-600 dark:text-zinc-300">
                      {row.close ?? "—"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
