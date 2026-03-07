"use client";

import { useState } from "react";

type AdminSectionProps = {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export default function AdminSection({
  title,
  description,
  defaultOpen = false,
  children,
}: AdminSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-4 p-6 text-left"
        aria-expanded={open}
      >
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          ) : null}
        </div>

        <span
          className={`mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm text-slate-600 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          ▼
        </span>
      </button>

      {open ? <div className="border-t p-6">{children}</div> : null}
    </div>
  );
}
