import { type DataTestId } from "@/constants/data-test-id";

interface TableFetchStateProps {
  hasRows: boolean;
  loading?: boolean;
  error?: string | null;
  loadingText: string;
  emptyText: string;
  loadingTestId?: DataTestId;
}

function TableStateMessage({
  message,
  dataTestId,
}: {
  message: string;
  dataTestId?: DataTestId;
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      <p className="text-sm text-zinc-500" data-testid={dataTestId}>
        {message}
      </p>
    </div>
  );
}

export function TableFetchState({
  hasRows,
  loading = false,
  error = null,
  loadingText,
  emptyText,
  loadingTestId,
}: TableFetchStateProps) {
  if (loading && !hasRows) {
    return (
      <TableStateMessage message={loadingText} dataTestId={loadingTestId} />
    );
  }
  if (error && !hasRows) {
    return <TableStateMessage message={error} />;
  }
  if (!hasRows) {
    return <TableStateMessage message={emptyText} />;
  }
  return null;
}
