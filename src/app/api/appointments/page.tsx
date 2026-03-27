"use client";

import { useState, useEffect } from "react";

interface Appointment {
  id: string;
  patient_name: string;
  patient_email: string | null;
  patient_phone: string | null;
  service: string | null;
  appointment_at: string;
  reminder_48h_sent_at: string | null;
  reminder_2h_sent_at: string | null;
  review_request_sent_at: string | null;
  status: string;
}

function formatDT(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    patient_name: "",
    patient_email: "",
    patient_phone: "",
    service: "",
    appointment_at: "",
    notes: "",
  });

  async function loadAppointments() {
    setLoading(true);
    const res = await fetch("/api/appointments");
    const data = await res.json();
    if (data.ok) setAppointments(data.appointments);
    setLoading(false);
  }

  useEffect(() => {
    loadAppointments();
  }, []);

  async function handleAdd() {
    if (!form.patient_name || !form.appointment_at) {
      setError("Patient name and appointment date are required.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);

    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        patient_email: form.patient_email || null,
        patient_phone: form.patient_phone || null,
        service: form.service || null,
        notes: form.notes || null,
        appointment_at: new Date(form.appointment_at).toISOString(),
      }),
    });

    const data = await res.json();
    if (data.ok) {
      setSuccess("Appointment added. Reminders will be sent automatically.");
      setForm({
        patient_name: "",
        patient_email: "",
        patient_phone: "",
        service: "",
        appointment_at: "",
        notes: "",
      });
      loadAppointments();
    } else {
      setError(data.error || "Failed to add appointment.");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this appointment?")) return;
    await fetch(`/api/appointments?id=${id}`, { method: "DELETE" });
    loadAppointments();
  }

  return (
    <div className="space-y-6">
      <div className="card-premium p-6 md:p-8">
        <p className="text-xs font-medium uppercase tracking-widest text-muted">
          Appointments
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          Appointment reminders
        </h1>
        <p className="mt-2 text-sm leading-7 text-muted">
          Add upcoming appointments and LeadClaw will automatically send
          patients a reminder email 48 hours before and again 2 hours before.
          After the appointment, a Google review request is sent automatically.
        </p>
      </div>

      <div className="card-premium p-6 md:p-8">
        <h2 className="text-lg font-semibold text-foreground">
          Add appointment
        </h2>
        <p className="mt-1 text-sm text-muted">
          Email address is required to send reminders.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-foreground">
              Patient name *
            </label>
            <input
              type="text"
              value={form.patient_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, patient_name: e.target.value }))
              }
              placeholder="Jane Smith"
              className="mt-1 w-full"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">
              Patient email
            </label>
            <input
              type="email"
              value={form.patient_email}
              onChange={(e) =>
                setForm((f) => ({ ...f, patient_email: e.target.value }))
              }
              placeholder="jane@example.com"
              className="mt-1 w-full"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Phone</label>
            <input
              type="text"
              value={form.patient_phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, patient_phone: e.target.value }))
              }
              placeholder="07700 900000"
              className="mt-1 w-full"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">
              Service
            </label>
            <input
              type="text"
              value={form.service}
              onChange={(e) =>
                setForm((f) => ({ ...f, service: e.target.value }))
              }
              placeholder="Botox consultation"
              className="mt-1 w-full"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">
              Appointment date & time *
            </label>
            <input
              type="datetime-local"
              value={form.appointment_at}
              onChange={(e) =>
                setForm((f) => ({ ...f, appointment_at: e.target.value }))
              }
              className="mt-1 w-full"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Notes</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              placeholder="Optional internal notes"
              className="mt-1 w-full"
            />
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        {success && <p className="mt-4 text-sm text-emerald-600">{success}</p>}

        <div className="mt-6">
          <button
            onClick={handleAdd}
            disabled={saving}
            className="button-primary"
          >
            {saving ? "Adding..." : "Add appointment"}
          </button>
        </div>
      </div>

      <div className="card-premium p-6 md:p-8">
        <h2 className="text-lg font-semibold text-foreground">
          Upcoming appointments
        </h2>

        {loading ? (
          <p className="mt-4 text-sm text-muted">Loading...</p>
        ) : appointments.length === 0 ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-border bg-surface-2 p-6 text-sm text-muted">
            <p className="font-medium text-foreground">No appointments yet</p>
            <p className="mt-2 leading-7">
              Add your first appointment above to start sending automated
              reminders.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {appointments.map((appt) => (
              <div
                key={appt.id}
                className="rounded-[22px] border border-border bg-white p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">
                      {appt.patient_name}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {formatDT(appt.appointment_at)}
                    </p>
                    {appt.service && (
                      <p className="mt-1 text-sm text-muted">{appt.service}</p>
                    )}
                    {appt.patient_email && (
                      <p className="mt-1 text-xs text-muted">
                        {appt.patient_email}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${appt.reminder_48h_sent_at ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}
                      >
                        48hr reminder{" "}
                        {appt.reminder_48h_sent_at ? "sent" : "pending"}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${appt.reminder_2h_sent_at ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}
                      >
                        2hr reminder{" "}
                        {appt.reminder_2h_sent_at ? "sent" : "pending"}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${appt.review_request_sent_at ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}
                      >
                        Review request{" "}
                        {appt.review_request_sent_at ? "sent" : "pending"}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(appt.id)}
                    className="shrink-0 text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
