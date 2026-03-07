"use client";

import { FormEvent, useEffect, useState } from "react";

type Msg = {
  id: string;
  sender: "client" | "agent";
  message: string;
  created_at: string;
};

export default function PortalChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="rounded-xl border bg-white p-6">
      <h2 className="mb-3 text-lg font-semibold">Support chat</h2>

      <div className="mb-3 max-h-64 space-y-2 overflow-y-auto rounded border p-3 text-sm">
        {messages.map((m) => (
          <div
            key={m.id}
            className={m.sender === "client" ? "text-right" : "text-left"}
          >
            <span
              className={
                m.sender === "client"
                  ? "inline-block rounded bg-slate-900 px-2 py-1 text-white"
                  : "inline-block rounded bg-slate-100 px-2 py-1"
              }
            >
              {m.message}
            </span>
          </div>
        ))}

        {!loading && messages.length === 0 && (
          <p className="text-slate-500">No messages yet.</p>
        )}

        {loading && <p className="text-slate-500">Loading messages...</p>}
      </div>

      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 rounded border p-2"
          placeholder="Message support..."
        />
        <button className="rounded bg-slate-900 px-3 py-2 text-white">
          Send
        </button>
      </form>

      {status && <p className="mt-2 text-xs text-slate-500">{status}</p>}
    </div>
  );
}
