"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchUserDetails = async () => {
      const { data: user, error } = await supabase.auth.getUser();

      if (error) {
        setStatus("Error fetching user details.");
        return;
      }

      if (user) {
        const { data, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (profileError) {
          setStatus("Error fetching user profile.");
        } else {
          setName(data?.name || "");
          setEmail(user.email || "");
          setPhone(data?.phone || "");
        }
      }
    };

    fetchUserDetails();
  }, []);

  // Update Name
  const handleNameUpdate = async () => {
    setLoading(true);
    setStatus("Updating your name...");

    try {
      const { error } = await supabase.auth.updateUser({
        data: { name },
      });

      if (error) {
        setStatus("Failed to update name. Try again.");
        setLoading(false);
        return;
      }

      setStatus("Name updated successfully.");
      setLoading(false);
    } catch (err) {
      setStatus("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  // Delete Account
  const handleDeleteAccount = async () => {
    if (
      !confirm(
        "Are you sure you want to delete your account? This action is irreversible.",
      )
    ) {
      return;
    }

    setDeleting(true);
    setStatus("Deleting your account...");

    try {
      const { error } = await supabase.auth.api.deleteUser(
        supabase.auth.user()?.id,
      );

      if (error) {
        setStatus("Failed to delete account. Try again.");
        setDeleting(false);
        return;
      }

      setStatus("Account deleted successfully.");
      router.push("/goodbye"); // Redirect to a goodbye page after deletion
    } catch (err) {
      setStatus("Something went wrong. Please try again.");
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 max-w-lg mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <p className="text-sm text-muted">Manage your account and settings.</p>

      {/* Profile Picture */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-foreground">
          Profile Picture
        </label>
        <input type="file" className="input-premium w-full" />
      </div>

      {/* Name Update */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-foreground">
          Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your new name"
          className="input-premium w-full"
        />
        <button
          onClick={handleNameUpdate}
          className="button-primary mt-4 w-full"
          disabled={loading}
        >
          {loading ? "Updating..." : "Update Name"}
        </button>
      </div>

      {/* Email */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-foreground">
          Email
        </label>
        <input
          type="email"
          value={email}
          disabled
          placeholder="Your email"
          className="input-premium w-full"
        />
      </div>

      {/* Phone Number */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-foreground">
          Phone Number
        </label>
        <input
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Enter your phone number"
          className="input-premium w-full"
        />
      </div>

      {/* Subscription Plan */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-foreground">
          Subscription Plan
        </label>
        <input
          type="text"
          value="Growth Plan"
          disabled
          className="input-premium w-full"
        />
      </div>

      {/* Status Message */}
      {status && <p className="text-sm text-muted">{status}</p>}

      {/* Delete Account */}
      <div className="mt-6">
        <button
          onClick={handleDeleteAccount}
          className="button-danger w-full"
          disabled={deleting}
        >
          {deleting ? "Deleting..." : "Delete Account"}
        </button>
      </div>
    </div>
  );
}
