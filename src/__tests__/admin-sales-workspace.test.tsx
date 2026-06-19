/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { render, screen, fireEvent } from "@testing-library/react";
import SalesWorkspaceClient from "@/app/admin/sales/sales-workspace-client";

// Default payloads keyed by endpoint. Each tab fetches read-only data on mount.
function defaultResponses(): Record<string, unknown> {
  return {
    "/api/lead-ops/board": {
      ok: true,
      summary: {
        total: 3,
        contacted: 1,
        replied: 0,
        interested: 1,
        notInterested: 0,
        followUpsDue: 2,
      },
      leads: [
        { id: "l1", company_name: "Acme Ltd", city: "London", status: "new" },
        {
          id: "l2",
          company_name: "Beta Co",
          city: "Leeds",
          status: "contacted",
        },
        {
          id: "l3",
          company_name: "Gamma Plc",
          city: "Bath",
          status: "do_not_contact",
        },
      ],
    },
    "/api/admin/outreach/queue": {
      ok: true,
      leads: [],
      totalChecked: 5,
      totalEligible: 4,
      templateMissing: false,
    },
    "/api/admin/outreach/activity": { ok: true, activities: [] },
    "/api/ops/activity": {
      ok: true,
      events: [
        {
          id: "e1",
          level: "info",
          category: "outreach",
          message: "Lead previewed",
          created_at: "2026-06-16T09:00:00.000Z",
        },
      ],
    },
    "/api/admin/sales/leads": {
      ok: true,
      leads: [
        {
          id: "l1",
          company_name: "Acme Ltd",
          niche: "plumber",
          city: "London",
          lead_quality_score: 88,
          status: "new",
          contact_email: "hello@acme.co.uk",
          website: "https://acme.co.uk",
        },
      ],
    },
  };
}

function mockFetch(responses: Record<string, unknown>) {
  (global as unknown as { fetch: jest.Mock }).fetch = jest.fn(
    async (input: unknown) => {
      const url = String(input);
      const key = Object.keys(responses).find((k) => url.includes(k));
      const body = key ? responses[key] : { ok: true };
      return {
        ok: true,
        status: 200,
        json: async () => body,
      } as unknown as Response;
    },
  );
}

describe("SalesWorkspaceClient", () => {
  const original = global.fetch;
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => {
    (global as unknown as { fetch: typeof original }).fetch = original;
  });

  it("renders the Overview tab by default with metric cards", async () => {
    mockFetch(defaultResponses());
    render(<SalesWorkspaceClient />);

    expect(
      await screen.findByText("Eligible outreach leads"),
    ).toBeInTheDocument();
    expect(screen.getByText("New leads")).toBeInTheDocument();
    expect(screen.getByText("Do not contact")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("groups Overview metrics into Today and Pipeline sections", async () => {
    mockFetch(defaultResponses());
    render(<SalesWorkspaceClient />);

    expect(
      await screen.findByRole("heading", { name: "Today" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Pipeline" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Follow-ups due")).toBeInTheDocument();
    expect(screen.getByText("Contacted leads")).toBeInTheDocument();
  });

  it("applies active-tab styling to the selected tab", async () => {
    mockFetch(defaultResponses());
    render(<SalesWorkspaceClient />);

    await screen.findByText("Eligible outreach leads");

    const overviewTab = screen.getByRole("tab", { name: "Overview" });
    const pipelineTab = screen.getByRole("tab", { name: "Pipeline" });

    // Active tab is visually distinct (solid app-tab style), inactive is not.
    expect(overviewTab).toHaveClass("bg-slate-900");
    expect(pipelineTab).not.toHaveClass("bg-slate-900");

    fireEvent.click(pipelineTab);

    expect(screen.getByRole("tab", { name: "Pipeline" })).toHaveClass(
      "bg-slate-900",
    );
    expect(screen.getByRole("tab", { name: "Overview" })).not.toHaveClass(
      "bg-slate-900",
    );
  });

  it("switches tabs to Outreach Review and shows the preview-only warning", async () => {
    mockFetch(defaultResponses());
    render(<SalesWorkspaceClient />);

    await screen.findByText("Eligible outreach leads");

    fireEvent.click(screen.getByRole("tab", { name: "Outreach Review" }));

    expect(await screen.findByText(/Preview only\. This page does not send outreach emails\./i)).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Outreach Review" }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("never renders a Send button on the Outreach Review tab", async () => {
    mockFetch(defaultResponses());
    render(<SalesWorkspaceClient />);

    await screen.findByText("Eligible outreach leads");
    fireEvent.click(screen.getByRole("tab", { name: "Outreach Review" }));
    await screen.findByText(/Preview only\. This page does not send outreach emails\./i);

    expect(screen.queryByRole("button", { name: /send/i })).toBeNull();
  });

  it("renders the Pipeline tab with the read-only MVP notice", async () => {
    mockFetch(defaultResponses());
    render(<SalesWorkspaceClient />);

    await screen.findByText("Eligible outreach leads");
    fireEvent.click(screen.getByRole("tab", { name: "Pipeline" }));

    expect(
      await screen.findByText(/Read-only pipeline \(MVP\)/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Demo Booked")).toBeInTheDocument();
  });

  it("renders the Lead Database tab and lists leads", async () => {
    mockFetch(defaultResponses());
    render(<SalesWorkspaceClient />);

    await screen.findByText("Eligible outreach leads");
    fireEvent.click(screen.getByRole("tab", { name: "Lead Database" }));

    expect(await screen.findByText("Acme Ltd")).toBeInTheDocument();
    expect(screen.getByText("hello@acme.co.uk")).toBeInTheDocument();
  });

  it("renders empty/placeholder states safely when sources are empty", async () => {
    const empty = defaultResponses();
    empty["/api/lead-ops/board"] = { ok: true, summary: undefined, leads: [] };
    empty["/api/admin/sales/leads"] = { ok: true, leads: [] };
    empty["/api/ops/activity"] = { ok: true, events: [] };
    mockFetch(empty);

    render(<SalesWorkspaceClient />);
    await screen.findByText("Eligible outreach leads");

    fireEvent.click(screen.getByRole("tab", { name: "Lead Database" }));
    expect(
      await screen.findByText(/No leads in the database yet/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Pipeline" }));
    expect(
      (await screen.findAllByText(/No leads in this stage/i)).length,
    ).toBeGreaterThan(0);
  });

  it("renders the Activity tab feed", async () => {
    mockFetch(defaultResponses());
    render(<SalesWorkspaceClient />);

    await screen.findByText("Eligible outreach leads");
    fireEvent.click(screen.getByRole("tab", { name: "Activity" }));

    expect(await screen.findByText("Agent Activity Log")).toBeInTheDocument();
    expect(await screen.findByText("Lead previewed")).toBeInTheDocument();
  });
});
