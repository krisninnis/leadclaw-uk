"use client";

import { useState } from "react";
import QueueClient from "@/app/admin/outreach/queue/queue-client";
import OpsActivityLog from "@/components/ops-activity-log";
import OverviewTab from "./overview-tab";
import PipelineTab from "./pipeline-tab";
import LeadDatabaseTab from "./lead-database-tab";

type TabKey =
  | "overview"
  | "outreach"
  | "pipeline"
  | "database"
  | "activity";

type TabDef = {
  key: TabKey;
  label: string;
  description: string;
};

const TABS: TabDef[] = [
  {
    key: "overview",
    label: "Overview",
    description: "Today's priorities and pipeline health at a glance.",
  },
  {
    key: "outreach",
    label: "Outreach Review",
    description:
      "Review eligible leads and take human actions. Preview only — nothing is sent.",
  },
  {
    key: "pipeline",
    label: "Pipeline",
    description: "Read-only view of leads grouped by stage.",
  },
  {
    key: "database",
    label: "Lead Database",
    description: "Search and filter every lead on record.",
  },
  {
    key: "activity",
    label: "Activity",
    description: "Recent operational and outreach activity (read-only).",
  },
];

export default function SalesWorkspaceClient() {
  const [active, setActive] = useState<TabKey>("overview");
  const activeTab = TABS.find((t) => t.key === active) ?? TABS[0];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Sticky app-style tab bar */}
      <div className="sticky top-[57px] z-30 border-b border-slate-200 bg-slate-50/95 backdrop-blur">
        <div
          role="tablist"
          aria-label="Sales workspace"
          className="flex flex-wrap gap-1 px-2 py-2 sm:px-3"
        >
          {TABS.map((tab) => {
            const selected = active === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                id={`sales-tab-${tab.key}`}
                aria-selected={selected}
                aria-controls={`sales-panel-${tab.key}`}
                onClick={() => setActive(tab.key)}
                className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  selected
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-muted hover:bg-white hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel header for the active tab */}
      <div className="border-b border-slate-200 bg-white px-5 py-4 md:px-6">
        <h2 className="text-base font-semibold text-foreground">
          {activeTab.label}
        </h2>
        <p className="mt-0.5 text-sm text-muted">{activeTab.description}</p>
      </div>

      {/* Panel body */}
      <div
        role="tabpanel"
        id={`sales-panel-${active}`}
        aria-labelledby={`sales-tab-${active}`}
        className="bg-slate-50/60 p-5 md:p-6"
      >
        {active === "overview" && <OverviewTab />}

        {active === "outreach" && <QueueClient />}

        {active === "pipeline" && <PipelineTab />}

        {active === "database" && <LeadDatabaseTab />}

        {active === "activity" && (
          <div className="space-y-4">
            <OpsActivityLog />
          </div>
        )}
      </div>
    </div>
  );
}
