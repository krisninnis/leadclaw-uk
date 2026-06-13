"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { trackGaEvent } from "@/lib/ga";

type ContactForm = {
  name: string;
  email: string;
  clinic: string;
  website: string;
  planInterest: string;
  issueType: string;
  message: string;
};

const initialForm: ContactForm = {
  name: "",
  email: "",
  clinic: "",
  website: "",
  planInterest: "basic",
  issueType: "general",
  message: "",
};

export default function ContactPage() {
  const [form, setForm] = useState<ContactForm>(initialForm);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus("Sending...");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setStatus(data?.error || "Could not send your message right now.");
        return;
      }

      trackGaEvent("contact_form_submitted", {
        route: "/contact",
        plan_interest: form.planInterest,
        issue_type: form.issueType,
      });
      setStatus(
        "Thanks - your message is in. A real person will reply within one business day, usually much faster.",
      );
      setForm(initialForm);
    } catch {
      setStatus("Could not send your message right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-hero section-shell">
      <div className="container-shell">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="card-premium p-6 md:p-8">
            <div className="badge-soft">
              <span className="h-2 w-2 rounded-full bg-brand" />
              Contact LeadClaw
            </div>
            <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
              Get help with your AI receptionist setup.
            </h1>
            <p className="mt-4 text-lg leading-8 text-muted">
              Ask about trials, pricing, billing, installation, or whether
              LeadClaw is a fit for your business or clinic.
            </p>

            <div className="mt-6 grid gap-3 text-sm text-muted">
              <div className="rounded-[20px] border border-border bg-white p-4">
                <p className="font-semibold text-foreground">Sales questions</p>
                <p className="mt-1 leading-6">
                  Compare Basic, Growth, and Pro or ask which plan fits your
                  enquiry volume.
                </p>
              </div>
              <div className="rounded-[20px] border border-border bg-white p-4">
                <p className="font-semibold text-foreground">Support</p>
                <p className="mt-1 leading-6">
                  Existing customers can also use the support area inside the
                  portal for installation and billing help.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/pricing" className="button-secondary">
                View pricing
              </Link>
              <Link href="/demo" className="button-secondary">
                Book demo
              </Link>
              <Link href="/" className="button-secondary">
                Back to home
              </Link>
            </div>
          </section>

          <form onSubmit={submit} className="card-premium space-y-4 p-6 md:p-8">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                Send a message
              </h2>
              <p className="mt-2 text-sm leading-7 text-muted">
                Do not include sensitive medical details or customer personal
                data in this form.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Your name"
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
                required
              />
              <Field
                label="Email"
                type="email"
                value={form.email}
                onChange={(v) => setForm({ ...form, email: v })}
                required
              />
              <Field
                label="Business / workspace"
                value={form.clinic}
                onChange={(v) => setForm({ ...form, clinic: v })}
                required
              />
              <Field
                label="Website"
                type="url"
                value={form.website}
                onChange={(v) => setForm({ ...form, website: v })}
              />
            </div>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">
                Plan interest
              </span>
              <select
                className="input-premium"
                value={form.planInterest}
                onChange={(e) =>
                  setForm({ ...form, planInterest: e.target.value })
                }
              >
                <option value="basic">Basic</option>
                <option value="growth">Growth</option>
                <option value="pro">Pro</option>
                <option value="unsure">Not sure yet</option>
              </select>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">
                Message type
              </span>
              <select
                className="input-premium"
                value={form.issueType}
                onChange={(e) =>
                  setForm({ ...form, issueType: e.target.value })
                }
              >
                <option value="general">General question</option>
                <option value="setup">Setup help</option>
                <option value="billing">Billing</option>
                <option value="complaint">Complaint or urgent issue</option>
              </select>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">
                Message
              </span>
              <textarea
                className="min-h-32 w-full rounded-[20px] border border-border bg-white px-4 py-3 text-foreground outline-none transition focus:border-brand"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="What do you need help with?"
                required
              />
            </label>

            <button disabled={loading} className="button-primary w-full">
              {loading ? "Sending..." : "Send message"}
            </button>

            {status ? <p className="text-sm text-muted">{status}</p> : null}
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-foreground">{label}</span>
      <input
        type={type}
        className="input-premium"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </label>
  );
}
