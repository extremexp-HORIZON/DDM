import React from "react";
import { Tag } from "primereact/tag";
import StepCard from "./TutorialStepCard";

const statusTag = (status) => {
  const s = (status || "pending").toLowerCase();
  const map = {
    pending: { label: "Pending", key: "open" },
    submitted: { label: "Submitted", key: "complete" },
    passed: { label: "Passed", key: "closed" },
    rejected: { label: "Rejected", key: "expired" },
  };
  const v = map[s] || map.pending;
  return <Tag value={v.label} className={`status-badge status-${v.key} text-xs`} />;
};

export default function TutorialCard({ tutorial, className }) {
  const t = tutorial;

  return (
    <div className={className}>
      <div className="suite-status-pill">{statusTag(t.status)}</div>

      <div className="mb-2">
        <div className="text-xs text-muted">Tutorial</div>
        <div className="font-semibold text-sm">
          {t.id} — {t.title}
        </div>
        <div className="text-xs text-muted mt-1">
          Created: {t.timestamp_created ? new Date(t.timestamp_created).toLocaleString() : "-"}
        </div>
      </div>

      {/* Step cards */}
      <div className="grid" style={{ gap: "0.75rem" }}>
        {(t.steps || []).map((step) => (
          <StepCard key={step.stepId} step={step} tutorial={t} />
        ))}
      </div>
    </div>
  );
}
