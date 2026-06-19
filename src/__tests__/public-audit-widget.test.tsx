/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PublicAuditWidget, {
  shouldShowBookDemo,
} from "@/components/audit/public-audit-widget";
import type { PublicAuditReport } from "@/lib/audit/public-report";

const REPORT: PublicAuditReport = {
  websiteUrl: "https://example.com",
  status: "completed",
  error: null,
  overallScore: 72,
  categoryScores: [
    { category: "health", label: "Website Health", score: 80 },
    { category: "seo", label: "SEO", score: 70 },
  ],
  topRecommendations: [
    {
      id: "cta",
      category: "conversion",
      categoryLabel: "Conversion",
      severity: "high",
      title: "Add a stronger call to action",
      detail: "Give visitors one obvious next step.",
      priority: 15,
    },
  ],
  fullReport: {
    recommendations: [
      {
        id: "cta",
        category: "conversion",
        categoryLabel: "Conversion",
        severity: "high",
        title: "Add a stronger call to action",
        detail: "Give visitors one obvious next step.",
        priority: 15,
      },
    ],
    categories: [
      {
        category: "health",
        label: "Website Health",
        score: 80,
        checks: [
          {
            id: "https",
            label: "HTTPS",
            category: "health",
            score: 1,
            weight: 1,
            passed: true,
            severity: "high",
            detail: "The page was served securely.",
            evidence: { found: "https://example.com" },
          },
        ],
      },
    ],
  },
};

describe("PublicAuditWidget", () => {
  it("shows Book Demo only below the score-80 threshold", () => {
    expect(shouldShowBookDemo(79)).toBe(true);
    expect(shouldShowBookDemo(80)).toBe(false);
  });

  it("captures all lead fields and reveals the immediate and full report", async () => {
    const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
      void url;
      void init;
      return {
        ok: true,
        json: async () => ({ ok: true, report: REPORT }),
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<PublicAuditWidget />);

    expect(screen.getByText("Unlock the full report")).toBeTruthy();
    expect(screen.queryByText("Top 5 recommendations")).toBeNull();

    fireEvent.change(screen.getByLabelText("Website URL"), {
      target: { value: "example.com" },
    });
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Alex Smith" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "alex@example.com" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Run my free audit" }));

    await waitFor(() => {
      expect(screen.getByText("Top 5 recommendations")).toBeTruthy();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/audit/public",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          websiteUrl: "example.com",
          name: "Alex Smith",
          email: "alex@example.com",
          consent: true,
        }),
      }),
    );
    expect(screen.getByLabelText("Overall score: 72 out of 100")).toBeTruthy();
    expect(screen.getByText("Full recommendations")).toBeTruthy();
    expect(screen.getByText("Full category breakdown")).toBeTruthy();
    expect(screen.getByText("Found:")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Book Demo" }).getAttribute("href"),
    ).toBe("/demo");
    expect(
      screen
        .getByRole("link", { name: "Start Free Trial" })
        .getAttribute("href"),
    ).toBe("/free-trial");
  });
});
