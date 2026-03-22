export default function Loading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-brand" />
        <p className="text-sm text-muted">Loading...</p>
      </div>
    </div>
  );
}