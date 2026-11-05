/** Shared loading and retry states for lists and detail pages. */
export function Feedback({ error, retry }: { error?: string; retry: () => void }) {
  return error ? (
    <div className="feedback">
      <p role="alert" className="error">
        {error}
      </p>
      <button className="button" onClick={retry}>
        Try again
      </button>
    </div>
  ) : (
    <p className="feedback muted" role="status">
      Loading…
    </p>
  );
}
export function Pagination({
  page,
  hasNext,
  onChange,
}: {
  page: number;
  hasNext: boolean;
  onChange: (page: number) => void;
}) {
  return (
    <nav className="pagination" aria-label="Pagination">
      <button className="button button-quiet" disabled={!page} onClick={() => onChange(page - 1)}>
        Previous
      </button>
      <span>Page {page + 1}</span>
      <button
        className="button button-quiet"
        disabled={!hasNext}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
