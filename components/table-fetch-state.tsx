interface TableFetchStateProps {
  hasRows: boolean;
  loading?: boolean;
  error?: string | null;
  loadingText: string;
  emptyText: string;
}

function TableStateMessage({ message }: { message: string }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      <p className="text-sm text-zinc-500">{message}</p>
    </div>
  );
}

export function TableFetchState({
  hasRows,
  loading = false,
  error = null,
  loadingText,
  emptyText,
}: TableFetchStateProps) {
  if (loading && !hasRows) {
    return <TableStateMessage message={loadingText} />;
  }
  if (error && !hasRows) {
    return <TableStateMessage message={error} />;
  }
  if (!hasRows) {
    return <TableStateMessage message={emptyText} />;
  }
  return null;
}
