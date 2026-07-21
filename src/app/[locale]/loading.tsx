export default function LocaleLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="mx-auto flex min-h-[55vh] w-full max-w-5xl flex-col justify-center px-4 py-12 sm:px-6"
    >
      <span className="sr-only">Loading page…</span>
      <div aria-hidden="true" className="w-full animate-pulse motion-reduce:animate-none">
        <div className="mb-8 h-3 w-24 rounded-full bg-[var(--border-subtle)]" />
        <div className="mb-3 h-8 w-3/4 max-w-md rounded-lg bg-[var(--bg-hover)]" />
        <div className="mb-10 h-4 w-full max-w-xl rounded bg-[var(--bg-hover)]" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-36 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)]" />
          ))}
        </div>
      </div>
    </div>
  );
}
