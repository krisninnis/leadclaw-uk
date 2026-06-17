// ClawLabsLocal — Landing Page Builder (Phase A)
// A labelled list of repeatable single-line or multi-line text rows with
// add/remove controls. Used for pains / benefits / features / use cases /
// services in the structured editor.

"use client";

type RepeatableFieldProps = {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
  addLabel?: string;
};

export default function RepeatableField({
  label,
  values,
  onChange,
  placeholder,
  hint,
  multiline = false,
  addLabel = "Add row",
}: RepeatableFieldProps) {
  function update(index: number, value: string) {
    const next = [...values];
    next[index] = value;
    onChange(next);
  }

  function remove(index: number) {
    onChange(values.filter((_, i) => i !== index));
  }

  function add() {
    onChange([...values, ""]);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-xs text-muted-2">{values.length}</span>
      </div>

      {values.length === 0 ? (
        <p className="text-xs text-muted">None yet.</p>
      ) : (
        <div className="space-y-2">
          {values.map((value, index) => (
            <div key={index} className="flex items-start gap-2">
              {multiline ? (
                <textarea
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  rows={2}
                  placeholder={placeholder}
                  value={value}
                  onChange={(event) => update(index, event.target.value)}
                />
              ) : (
                <input
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  placeholder={placeholder}
                  value={value}
                  onChange={(event) => update(index, event.target.value)}
                />
              )}
              <button
                type="button"
                className="shrink-0 rounded-lg border border-border px-2.5 py-2 text-xs font-medium text-muted hover:border-rose-300 hover:text-rose-600"
                onClick={() => remove(index)}
                aria-label={`Remove ${label} row ${index + 1}`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:border-border-strong hover:bg-surface-2"
        onClick={add}
      >
        + {addLabel}
      </button>

      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
