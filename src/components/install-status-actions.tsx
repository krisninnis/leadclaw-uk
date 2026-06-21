"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";

type TestState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "success" }
  | { kind: "error"; message: string };

export default function InstallStatusActions({
  canSendTest = true,
}: {
  canSendTest?: boolean;
}) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [testState, setTestState] = useState<TestState>({ kind: "idle" });

  function handleRefresh() {
    startRefresh(() => {
      router.refresh();
    });
  }

  async function handleSendTest() {
    setTestState({ kind: "sending" });

    try {
      const response = await fetch("/api/portal/test-enquiry", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      setTestState({ kind: "success" });
      track("test_enquiry_sent", { surface: "install_page" });
      // Surface the new test enquiry in the portal lists.
      router.refresh();
    } catch (error) {
      setTestState({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not send the test enquiry.",
      });
    }
  }

  return (
    <div className="mt-5 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center justify-center rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-2 disabled:opacity-60"
        >
          {isRefreshing ? "Refreshing…" : "Refresh status"}
        </button>

        {canSendTest && (
          <button
            type="button"
            onClick={handleSendTest}
            disabled={testState.kind === "sending"}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {testState.kind === "sending"
              ? "Sending test enquiry…"
              : "Send test enquiry"}
          </button>
        )}
      </div>

      {testState.kind === "success" && (
        <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">Test enquiry sent</p>
          <p className="mt-1 leading-6">
            A clearly marked test enquiry now appears in your Leads. It is
            flagged as a test, no emails were sent to real customers, and it
            won’t be counted as a real lead.
          </p>
        </div>
      )}

      {testState.kind === "error" && (
        <div className="rounded-[18px] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <p className="font-semibold">Couldn’t send test enquiry</p>
          <p className="mt-1 leading-6">{testState.message}</p>
        </div>
      )}

      {canSendTest && testState.kind === "idle" && (
        <p className="text-xs text-muted">
          Send a test enquiry to prove the full capture loop works end to end.
          It’s marked as a test and won’t email real customers.
        </p>
      )}
    </div>
  );
}
