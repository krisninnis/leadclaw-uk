import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export type PortalContext = {
  clientId: string;
  siteId: string | null;
  domain: string | null;
  siteStatus: string | null;
  clinicId: string | null;
  widgetToken: string | null;
  widgetLastSeenAt: string | null;
  widgetLastSeenDomain: string | null;
};

export type EnquiryStatus = "new" | "contacted" | "booked" | "lost";

export type EnquiryRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  created_at: string | null;
};

export const ENQUIRY_STATUS_OPTIONS: EnquiryStatus[] = [
  "new",
  "contacted",
  "booked",
  "lost",
];

export function normalizeEnquiryStatus(
  value: string | null | undefined,
): EnquiryStatus {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (normalized === "contacted") return "contacted";
  if (normalized === "booked") return "booked";
  if (normalized === "lost") return "lost";
  return "new";
}

export function statusBadgeClasses(status: EnquiryStatus) {
  switch (status) {
    case "contacted":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "booked":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "lost":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "new":
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

export function statusLabel(status: EnquiryStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export async function updateEnquiryStatus(formData: FormData) {
  "use server";

  const enquiryId = String(formData.get("enquiryId") || "").trim();
  const nextStatus = normalizeEnquiryStatus(
    String(formData.get("status") || "").trim(),
  );

  if (!enquiryId) return;

  const admin = createAdminClient();
  if (!admin) return;

  const { error } = await admin
    .from("enquiries")
    .update({ status: nextStatus })
    .eq("id", enquiryId);

  if (error) {
    console.error("[portal] failed to update enquiry status", error);
  }

  revalidatePath("/portal");
  revalidatePath("/portal/leads");
}
