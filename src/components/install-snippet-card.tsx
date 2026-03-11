"use client";

import { useState } from "react";

export default function InstallSnippetCard({
  widgetSnippet,
}: {
  widgetSnippet: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(widgetSnippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("[install-snippet-card] copy failed", error);
      setCopied(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded border bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium text-slate-800">
            Install snippet
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Paste this before the closing {"</body>"} tag on your website.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          {copied ? "Copied ✓" : "Copy code"}
        </button>
      </div>

      <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded border bg-white p-3 text-xs text-slate-700">
        <code>{widgetSnippet}</code>
      </pre>
    </div>
  );
}
