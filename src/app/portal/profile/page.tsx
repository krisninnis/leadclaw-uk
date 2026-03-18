"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  // States for profile data and status
  const [profile, setProfile] = useState<any>({
    name: "",
    phone: "",
    clinic_name: "",
  });
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch user profile from Supabase
  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setStatus("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: userProfile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();

      if (error) {
        setStatus("Could not load your profile.");
        setLoading(false);
        return;
      }

      setProfile(userProfile);
      setLoading(false);
    }

    loadProfile();
  }, [supabase]);

  // Handle saving profile
  const handleSaveProfile = async () => {
    setSaving(true);
    setStatus("Saving profile...");

    const { error } = await supabase.from("profiles").upsert({
      id: profile.id,
      name: profile.name,
      phone: profile.phone,
      clinic_name: profile.clinic_name,
    });

    if (error) {
      setStatus("Failed to save profile.");
      setSaving(false);
      return;
    }

    setStatus("Profile updated successfully.");
    setSaving(false);
  };

  // Handle deleting account
  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete your account? This cannot be undone.",
    );
    if (!confirmed) return;

    setStatus("Deleting account...");
    const { error } = await supabase.auth.api.deleteUser(profile.id);

    if (error) {
      setStatus("Failed to delete account.");
      return;
    }

    setStatus("Account deleted successfully.");
    router.replace("/goodbye");
  };

  const calculateCompleteness = () => {
    let completeness = 0;
    if (profile.name) completeness += 33;
    if (profile.phone) completeness += 33;
    if (profile.clinic_name) completeness += 33;
    return completeness;
  };

  const completeness = calculateCompleteness();

  return (
    <div className="space-y-6 p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold">Your Profile</h1>

      {loading && <p>Loading...</p>}

      {/* Profile Completeness Section */}
      <div className="mb-4">
        <p>Profile Completeness: {completeness}%</p>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-blue-500 h-2.5 rounded-full"
            style={{ width: `${completeness}%` }}
          />
        </div>
      </div>

      {/* Form Fields */}
      <div>
        <label className="block text-sm font-medium">Full Name</label>
        <input
          type="text"
          className="w-full border px-3 py-2 mt-2 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500"
          value={profile.name || ""}
          onChange={(e) => setProfile({ ...profile, name: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Phone Number</label>
        <input
          type="text"
          className="w-full border px-3 py-2 mt-2 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500"
          value={profile.phone || ""}
          onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Clinic Name</label>
        <input
          type="text"
          className="w-full border px-3 py-2 mt-2 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500"
          value={profile.clinic_name || ""}
          onChange={(e) =>
            setProfile({ ...profile, clinic_name: e.target.value })
          }
        />
      </div>

      <button
        onClick={handleSaveProfile}
        disabled={saving}
        className="mt-4 w-full bg-blue-600 text-white py-2 rounded-md shadow-md hover:bg-blue-700 disabled:opacity-50 transition"
      >
        {saving ? "Saving..." : "Save Profile"}
      </button>

      {/* Delete Account Button */}
      <button
        onClick={handleDeleteAccount}
        className="mt-4 w-full bg-red-600 text-white py-2 rounded-md shadow-md hover:bg-red-700 transition"
      >
        Delete Account
      </button>

      {/* Feedback Message */}
      {status && (
        <p
          className={`mt-2 text-sm ${status.includes("success") ? "text-green-500" : "text-red-500"}`}
        >
          {status}
        </p>
      )}
    </div>
  );
}
