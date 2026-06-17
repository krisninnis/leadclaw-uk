// ClawLabsLocal — Landing Page Builder (Phase A)
// Admin list: filters + table + row actions (edit / preview / publish /
// unpublish / archive / open). Pure client interactions over the API; the
// server page provides the initial rows.

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LandingPageListItem, LandingStatus } from "@/lib/landing/types";

type Props = {
  initialPages: LandingPageListItem[];
};

function statusClass(status: LandingStatus) {
  if (status === "published") return "bg-emerald-100 text-emerald-700";
  if (status === "archived") return "bg-slate-200 text-slate-700";
  return "bg-amber-100 text-amber-800";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function LandingPagesClient({ initialPages }: Props) {
  const router = useRouter();
  const [pages, setPages] = useState(initialPages);
  const [statusFilter, setStatusFilter] = useState<"all" | LandingStatus>("all");
  const [nicheFilter, setNicheFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const niches = useMemo(
    () =>
      Array.from(new Set(pages.map((p) => p.niche).filter(Boolean))) as string[],
    [pages],
  );
  const cities = useMemo(
    () =>
      Array.from(new Set(pages.map((p) => p.city).filter(Boolean))) as string[],
    [pages],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return pages.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (nicheFilter !== "all" && p.niche !== nicheFilter) return false;
      if (cityFilter !== "all" && p.city !== cityFilter) return false;
      if (term) {
        const hay = `${p.slug} ${p.seo_title ?? ""} ${p.city ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [pages, statusFilter, nicheFilter, cityFilter, search]);

  async function refresh() {
    try {
      const res = await fetch("/api/admin/landing-pages");
      const body = await res.json();
      if (body.ok) setPages(body.pages);
    } catch {
      router.refresh();
    }
  }

  async function act(id: string, action: "publish" | "unpublish" | "archive") {
    setBusyId(id);
    setMessage(null);
    try {
      const url =
        action === "archive"
          ? `/api/admin/landing-pages/${id}`
          : `/api/admin/landing-pages/${id}/${action}`;
      const res = await fetch(url, {
        method: action === "archive" ? "DELETE" : "POST",
      });
      const body = await res.json();
      if (res.status === 422) {
        setMessage(
          "Publish blocked — open the editor to resolve the validation checklist.",
        );
        return;
      }
      if (!res.ok || !body.ok) throw new Error(body.error || "Action failed");
      await refresh();
      router.refresh();
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card-premium flex flex-wrap items-end gap-3 p-4">
        <label className="space-y-1">
          <span className="block text-xs font-medium text-muted">Status</span>
          <select
            className="rounded-lg border px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "all" | LandingStatus)
            }
          >
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-muted">Niche</span>
          <select
            className="rounded-lg border px-3 py-2 text-sm"
            value={nicheFilter}
            onChange={(e) => setNicheFilter(e.target.value)}
          >
            <option value="all">All</option>
            {niches.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-muted">City</span>
          <select
            className="rounded-lg border px-3 py-2 text-sm"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
          >
            <option value="all">All</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1 space-y-1">
          <span className="block text-xs font-medium text-muted">Search</span>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="slug, title, city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>

      {message ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {message}
        </p>
      ) : null}

      <div className="card-premium overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-2">
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Niche / City</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">
                    No landing pages match these filters.
                  </td>
                </tr>
              ) : (
                filtered.map((page) => (
                  <tr key={page.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {page.slug}
                      {page.noindex ? (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-muted">
                          noindex
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {[page.niche, page.city].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(
                          page.status,
                        )}`}
                      >
                        {page.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {formatDate(page.updated_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link
                          href={`/admin/landing-pages/${page.id}`}
                          className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-surface-2"
                        >
                          Edit
                        </Link>
                        <Link
                          href={`/admin/landing-pages/${page.id}/preview`}
                          className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-surface-2"
                          target="_blank"
                        >
                          Preview
                        </Link>
                        {page.status === "published" ? (
                          <button
                            type="button"
                            disabled={busyId === page.id}
                            onClick={() => act(page.id, "unpublish")}
                            className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-surface-2"
                          >
                            Unpublish
                          </button>
                        ) : page.status === "draft" ? (
                          <button
                            type="button"
                            disabled={busyId === page.id}
                            onClick={() => act(page.id, "publish")}
                            className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-surface-2"
                          >
                            Publish
                          </button>
                        ) : null}
                        {page.status !== "archived" ? (
                          <button
                            type="button"
                            disabled={busyId === page.id}
                            onClick={() => act(page.id, "archive")}
                            className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted hover:border-rose-300 hover:text-rose-600"
                          >
                            Archive
                          </button>
                        ) : null}
                        {page.status === "published" ? (
                          <a
                            href={`/lp/${page.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-surface-2"
                          >
                            Open ↗
                          </a>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
