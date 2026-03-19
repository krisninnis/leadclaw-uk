"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Msg = {
  id: string;
  sender: "client" | "agent";
  message: string;
  created_at: string;
};

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

export default function PortalChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/messages", {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) {
        setStatus("Support chat is temporarily unavailable.");
        return;
      }

      const data = (await res.json()) as {
        ok?: boolean;
        messages?: Msg[];
        error?: string;
      };

      if (data.ok && Array.isArray(data.messages)) {
        setMessages(data.messages);
        setStatus("");
      } else {
        setStatus("Support chat is temporarily unavailable.");
      }
    } catch {
      setStatus("Support chat is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();

    const interval = setInterval(() => {
      void load();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    const message = text.trim();
    if (!message) return;

    setStatus("Sending...");

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) {
        setStatus("Failed to send");
        return;
      }

      const data = (await res.json()) as { ok?: boolean };

      if (!data.ok) {
        setStatus("Failed to send");
        return;
      }

      setText("");
      setStatus("Sent");
      await load();
    } catch {
      setStatus("Failed to send");
    }
  }

  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ),
    [messages],
  );

  return (
    <div className="card-premium p-6 md:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-strong">
            Support chat
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            Message LeadClaw support
          </h2>
          <p className="mt-2 text-sm leading-7 text-muted">
            Send setup questions, onboarding updates, or anything you need help
            with inside your clinic workspace.
          </p>
        </div>

        <div className="rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-muted shadow-sm">
          {loading ? "Loading..." : `${sortedMessages.length} messages`}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="mt-6 max-h-[420px] space-y-4 overflow-y-auto rounded-[24px] border border-border bg-surface-2 p-4"
      >
        {sortedMessages.map((m) => {
          const isClient = m.sender === "client";

          return (
            <div
              key={m.id}
              className={`flex ${isClient ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-[20px] px-4 py-3 shadow-sm ${
                  isClient
                    ? "bg-slate-900 text-white"
                    : "border border-border bg-white text-foreground"
                }`}
              >
                <p className="text-sm leading-7">{m.message}</p>
                <p
                  className={`mt-2 text-[11px] ${
                    isClient ? "text-slate-300" : "text-muted"
                  }`}
                >
                  {isClient ? "You" : "LeadClaw"} •{" "}
                  {formatMessageTime(m.created_at)}
                </p>
              </div>
            </div>
          );
        })}

        {!loading && sortedMessages.length === 0 && (
          <div className="rounded-[20px] border border-dashed border-border bg-white p-5 text-sm text-muted">
            <p className="font-medium text-foreground">No messages yet</p>
            <p className="mt-2 leading-7">
              Start the conversation below and your message will appear here.
            </p>
          </div>
        )}

        {loading && (
          <div className="rounded-[20px] border border-dashed border-border bg-white p-5 text-sm text-muted">
            Loading messages...
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <label
          htmlFor="portal-support-message"
          className="block text-sm font-medium text-foreground"
        >
          Your message
        </label>

        <textarea
          id="portal-support-message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-[120px] w-full rounded-[20px] border border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-brand"
          placeholder="Ask for help with setup, billing, your widget, leads, or onboarding..."
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted">
            Messages are shared inside your LeadClaw workspace.
          </p>

          <button type="submit" className="button-primary">
            Send message
          </button>
        </div>
      </form>

      {status ? <p className="mt-3 text-xs text-muted">{status}</p> : null}
    </div>
  );
}
