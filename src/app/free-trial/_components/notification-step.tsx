"use client";
import { useState } from "react";

type Props = {
  onSave: (whatsapp: string, sms: string) => Promise<void>;
  onSkip: () => void;
};

export default function NotificationStep({ onSave, onSkip }: Props) {
  const [notifyWhatsapp, setNotifyWhatsapp] = useState("");
  const [notifySms, setNotifySms] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(notifyWhatsapp.trim(), notifySms.trim());
    setSaving(false);
  }

  return (
    <div className="min-h-screen bg-white px-6 py-10">
      <div className="mx-auto max-w-md space-y-6">
        <div className="text-center">
          <p className="text-sm text-muted">LeadClaw</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            Get notified instantly
          </h1>
          <p className="mt-3 text-sm text-muted">
            Choose how you want to be alerted when a new enquiry arrives. Email
            is always on.
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-white p-6 shadow-sm space-y-5">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
            <span className="text-lg">✅</span>
            <div>
              <p className="text-sm font-semibold text-emerald-900">
                Email notifications
              </p>
              <p className="text-xs text-emerald-700">
                Always on — every new lead sent to your inbox
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-foreground">
              📱 WhatsApp number{" "}
              <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              type="tel"
              placeholder="+44 7700 900000"
              value={notifyWhatsapp}
              onChange={(e) => setNotifyWhatsapp(e.target.value)}
              className="input-premium w-full"
            />
            <p className="text-xs text-muted">
              Get a WhatsApp message the moment a lead arrives
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-foreground">
              💬 SMS number{" "}
              <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              type="tel"
              placeholder="+44 7700 900000"
              value={notifySms}
              onChange={(e) => setNotifySms(e.target.value)}
              className="input-premium w-full"
            />
            <p className="text-xs text-muted">
              Get a text message for every new enquiry
            </p>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="button-primary w-full"
          >
            {saving ? "Saving..." : "Save and go to portal →"}
          </button>

          <button
            type="button"
            onClick={onSkip}
            className="w-full text-sm text-center text-muted underline"
          >
            Skip for now — set up later in settings
          </button>
        </div>
      </div>
    </div>
  );
}
