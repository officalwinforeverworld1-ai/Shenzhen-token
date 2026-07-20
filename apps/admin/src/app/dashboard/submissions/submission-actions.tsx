"use client";

import { approveSubmissionAction, rejectSubmissionAction } from "@/lib/actions";
import { useTransition } from "react";

export function SubmissionActions({ submissionId }: { submissionId: number }) {
  const [isPending, startTransition] = useTransition();

  const handleApprove = () => {
    startTransition(async () => {
      await approveSubmissionAction(submissionId);
      window.location.reload();
    });
  };

  const handleReject = () => {
    if (!confirm("Reject this submission?")) return;
    startTransition(async () => {
      await rejectSubmissionAction(submissionId);
      window.location.reload();
    });
  };

  return (
    <div style={{ display: "flex", gap: "0.5rem" }}>
      <button
        onClick={handleApprove}
        disabled={isPending}
        className="btn btn-sm btn-success"
      >
        {isPending ? "..." : "✅ Approve"}
      </button>
      <button
        onClick={handleReject}
        disabled={isPending}
        className="btn btn-sm btn-danger"
      >
        {isPending ? "..." : "❌ Reject"}
      </button>
    </div>
  );
}
