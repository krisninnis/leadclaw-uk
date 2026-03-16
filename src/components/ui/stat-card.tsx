type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
};

export default function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-white px-4 py-4">
      <p className="text-xs uppercase tracking-[0.14em] text-muted-2">
        {label}
      </p>

      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>

      {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
    </div>
  );
}
