"use client";

import { toggleTaskAction } from "@/lib/actions";
import { useTransition } from "react";

export function TaskActions({
  taskId,
  isActive,
}: {
  taskId: number;
  isActive: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(async () => {
      await toggleTaskAction(taskId, !isActive);
      window.location.reload();
    });
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`btn btn-sm ${isActive ? "btn-danger" : "btn-success"}`}
    >
      {isPending ? "..." : isActive ? "Deactivate" : "Activate"}
    </button>
  );
}
