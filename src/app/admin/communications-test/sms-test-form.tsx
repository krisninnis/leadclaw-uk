"use client";

import { useState } from "react";
import type { CommunicationResult } from "@/lib/communications";

const DEFAULT_MESSAGE =
  "LeadClaw SMS test: your communications layer is working.";

type ResultState =
  | "idle"
  | "sending"
  | "sent"
  | "provider_not_configured"
  | "invalid_recipient"
  | "send_failed";

function stateForResult(result: CommunicationResult): ResultState {
  if (result.ok) return "sent";
  if (result.error === "provider_not_configured") {
    return "provider_not_configured";
  }
  if (result.error === "invalid_recipient") return "invalid_recipient";
  return "send_failed";
}

function resultMessage(state: ResultState) {
  switch (state) {
    case "sent":
      return "SMS test sent. Check the provider and communication event log.";
    case "provider_not_configured":
      return "No SMS provider is configured, so no message was sent.";
    case "invalid_recipient":
      return "Enter a valid UK or E.164 phone number before sending.";
    case "send_failed":
      return "The provider returned a send failure. No secrets are shown here.";
    case "sending":
      return "Sending test SMS...";
    default:
      return "Send a single admin-only SMS through the communications layer.";
  }
}

export default function SmsTestForm() {
  const [to, setTo] = useState("");
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [state, setState] = useState<ResultState>("idle");
  const [result, setResult] = useState<CommunicationResult | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setResult(null);

    try {
      const response = await fetch("/api/admin/communications/test-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, message }),
      });

      const payload = (await response.json()) as CommunicationResult;
      setResult(payload);
      setState(stateForResult(payload));
    } catch {
      setState("send_failed");
    }
  }

  const isSending = state === "sending";

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="sms-to" className="text-sm font-medium text-slate-900">
          Phone number
        </label>
        <input
          id="sms-to"
          name="to"
          type="tel"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          placeholder="+44 7700 900123"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 shadow-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
          autoComplete="tel"
          required
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="sms-message"
          className="text-sm font-medium text-slate-900"
        >
          Message
        </label>
        <textarea
          id="sms-message"
          name="message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={4}
          maxLength={500}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 shadow-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
        />
        <p className="text-xs text-slate-500">
          Max 500 characters. Leave the default unless you need to prove custom
          body handling.
        </p>
      </div>

      <button
        type="submit"
        disabled={isSending}
        className="button-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSending ? "Sending..." : "Send test SMS"}
      </button>

      <div
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"
      >
        <p className="font-medium text-slate-950">Result: {state}</p>
        <p className="mt-1">{resultMessage(state)}</p>
        {result ? (
          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Provider</dt>
              <dd className="font-mono text-slate-900">{result.provider}</dd>
            </div>
            {result.ok ? (
              <>
                <div>
                  <dt className="text-slate-500">Provider message ID</dt>
                  <dd className="font-mono text-slate-900">
                    {result.providerMessageId ?? "not returned"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Communication event ID</dt>
                  <dd className="font-mono text-slate-900">
                    {result.eventId ?? "not logged locally"}
                  </dd>
                </div>
              </>
            ) : (
              <div>
                <dt className="text-slate-500">Error</dt>
                <dd className="font-mono text-slate-900">{result.error}</dd>
              </div>
            )}
          </dl>
        ) : null}
      </div>
    </form>
  );
}
