"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  id?: string;
  name?: string | null;
  phone?: string | null;
  clinic_name?: string | null;
  email?: string | null;
};

function buildFallbackName(email: string, metadata: Record<string, unknown>) {
  const metadataName =
    String(metadata?.name || "").trim() ||
    String(metadata?.full_name || "").trim();

  if (metadataName) return metadataName;

  const emailName = email
    .split("@")[0]
    ?.replace(/[._-]+/g, " ")
    .trim();
  if (emailName) return emailName;

  return "";
}

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [profile, setProfile] = useState<Profile>({
    name: "",
    phone: "",
    clinic_name: "",
    email: "",
  });
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setStatus("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setStatus("You need to sign in again.");
        setLoading(false);
        router.replace("/login");
        return;
      }

      const normalizedEmail = (user.email || "").trim().toLowerCase();
      const fallbackName = buildFallbackName(
        normalizedEmail,
        (user.user_metadata ?? {}) as Record<string, unknown>,
      );

      const { data: userProfile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        setStatus("Could not load your profile.");
        setLoading(false);
        return;
      }

      setProfile({
        id: user.id,
        name: userProfile?.name ?? fallbackName,
        phone: userProfile?.phone ?? "",
        clinic_name: userProfile?.clinic_name ?? "",
        email: userProfile?.email ?? normalizedEmail,
      });

      setLoading(false);
    }

    loadProfile();
  }, [router, supabase]);

  const handleSaveProfile = async () => {
    setSaving(true);
    setStatus("Saving profile...");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setStatus("You need to sign in again.");
      setSaving(false);
      router.replace("/login");
      return;
    }

    const normalizedEmail = (profile.email || user.email || "")
      .trim()
      .toLowerCase();

    const payload = {
      id: user.id,
      name: profile.name?.trim() || "",
      phone: profile.phone?.trim() || "",
      clinic_name: profile.clinic_name?.trim() || "",
      email: normalizedEmail,
    };

    const { error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" });

    if (error) {
      setStatus(`Failed to save profile: ${error.message}`);
      setSaving(false);
      return;
    }

    setStatus("Profile updated successfully.");
    setSaving(false);
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete your account? This will also cancel any active subscription immediately. This cannot be undone.",
    );

    if (!confirmed || deleting) return;

    setDeleting(true);
    setStatus("Deleting your account and canceling billing...");

    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        setStatus(result?.error || "Failed to delete account.");
        setDeleting(false);
        return;
      }

      await supabase.auth.signOut().catch(() => undefined);
      router.replace("/goodbye");
      router.refresh();
    } catch {
      setStatus("Something went wrong. Please try again.");
      setDeleting(false);
    }
  };

  const completeness = (() => {
    let value = 0;
    if (profile.name) value += 25;
    if (profile.phone) value += 25;
    if (profile.clinic_name) value += 25;
    if (profile.email) value += 25;
    return value;
  })();

  return (
    <div className="space-y-6 p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold">Your Profile</h1>

      {loading ? <p>Loading...</p> : null}

      <div className="mb-4">
        <p>Profile Completeness: {completeness}%</p>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-blue-500 h-2.5 rounded-full"
            style={{ width: `${completeness}%` }}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">Full Name</label>
        <input
          type="text"
          className="w-full border px-3 py-2 mt-2 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500"
          value={profile.name ?? ""}
          onChange={(e) => setProfile({ ...profile, name: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Phone Number</label>
        <input
          type="text"
          className="w-full border px-3 py-2 mt-2 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500"
          value={profile.phone ?? ""}
          onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Clinic Name</label>
        <input
          type="text"
          className="w-full border px-3 py-2 mt-2 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500"
          value={profile.clinic_name ?? ""}
          onChange={(e) =>
            setProfile({ ...profile, clinic_name: e.target.value })
          }
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Email Address</label>
        <input
          type="email"
          className="w-full border px-3 py-2 mt-2 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500"
          value={profile.email ?? ""}
          onChange={(e) => setProfile({ ...profile, email: e.target.value })}
        />
      </div>

      <button
        onClick={handleSaveProfile}
        disabled={saving || loading}
        className="mt-4 w-full bg-blue-600 text-white py-2 rounded-md shadow-md hover:bg-blue-700 disabled:opacity-50 transition"
      >
        {saving ? "Saving..." : "Save Profile"}
      </button>

      <button
        onClick={handleDeleteAccount}
        disabled={deleting || loading}
        className="mt-4 w-full bg-red-600 text-white py-2 rounded-md shadow-md hover:bg-red-700 disabled:opacity-50 transition"
      >
        {deleting ? "Deleting..." : "Delete Account"}
      </button>

      {status ? (
        <p
          className={`mt-2 text-sm ${
            status.toLowerCase().includes("success")
              ? "text-green-500"
              : "text-red-500"
          }`}
        >
          {status}
        </p>
      ) : null}
    </div>
  );
}
