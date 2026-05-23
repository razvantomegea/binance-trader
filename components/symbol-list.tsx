"use client";

import clsx from "clsx";
import { useMemo, useState } from "react";

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
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 p-3 dark:border-zinc-800">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search symbol..."
          className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
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
                    <span className="font-medium">{row.symbol}</span>
                    <span className="text-right">
                      <span className="block tabular-nums text-zinc-600 dark:text-zinc-300">
                        {row.close ?? "—"}
                      </span>
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
