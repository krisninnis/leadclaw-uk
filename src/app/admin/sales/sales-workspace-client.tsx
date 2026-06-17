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

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "outreach", label: "Outreach Review" },
  { key: "pipeline", label: "Pipeline" },
  { key: "database", label: "Lead Database" },
  { key: "activity", label: "Activity" },
];

export default function SalesWorkspaceClient() {
  const [active, setActive] = useState<TabKey>("overview");

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Sales workspace"
        className="flex flex-wrap gap-2 border-b border-slate-200"
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
              className={`-mb-px rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                selected
                  ? "border-brand text-foreground"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`sales-panel-${active}`}
        aria-labelledby={`sales-tab-${active}`}
      >
        {active === "overview" && <OverviewTab />}

        {active === "outreach" && <QueueClient />}

        {active === "pipeline" && <PipelineTab />}

        {active === "database" && <LeadDatabaseTab />}

        {active === "activity" && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Recent operational and outreach activity. Read-only feed sourced
              from the agent activity log.
            </p>
            <OpsActivityLog />
          </div>
        )}
      </div>
    </div>
  );
}
