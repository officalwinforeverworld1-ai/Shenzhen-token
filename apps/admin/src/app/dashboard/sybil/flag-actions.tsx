"use client";

import { resolveFlagAction } from "@/lib/actions";
import { useTransition } from "react";

export function FlagActions({ flagId }: { flagId: number }) {
  const [isPending, startTransition] = useTransition();

  const handleResolve = (resolution: "dismissed" | "banned" | "cleared") => {
    if (resolution === "banned") {
      if (!confirm("Ban this user? This will flag their account immediately.")) return;
    }

    startTransition(async () => {
      await resolveFlagAction(flagId, resolution);
      window.location.reload();
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
      <button
        onClick={() => handleResolve("cleared")}
        disabled={isPending}
        className="btn btn-sm btn-success"
      >
        {isPending ? "..." : "✅ Clear"}
      </button>
      <button
        onClick={() => handleResolve("dismissed")}
        disabled={isPending}
        className="btn btn-sm btn-ghost"
      >
        {isPending ? "..." : "👋 Dismiss"}
      </button>
      <button
        onClick={() => handleResolve("banned")}
        disabled={isPending}
        className="btn btn-sm btn-danger"
      >
        {isPending ? "..." : "🚫 Ban"}
      </button>
    </div>
  );
}
