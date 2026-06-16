// Phase 3 — AI Visibility (Foundation)
// Competitor benchmarking section. The data model for competitor scans is not
// built yet, so this is an intentional "Coming soon" placeholder that still
// communicates the planned value.

export default function CompetitorPlaceholder() {
  const previews = [
    "See which competitors AI assistants recommend ahead of you",
    "Compare your schema, authority, and content coverage side by side",
    "Get a watch-list of the gaps closing fastest",
  ];

  return (
    <div className="rounded-[22px] border border-dashed border-border bg-surface-2 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg shadow-sm">
          🥊
        </div>
        <div>
          <p className="font-medium text-foreground">Competitor benchmarking</p>
          <p className="text-sm text-muted">Coming soon</p>
        </div>
      </div>
      <ul className="mt-4 space-y-2">
        {previews.map((line) => (
          <li key={line} className="flex items-start gap-2 text-sm leading-7 text-muted">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-2" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
