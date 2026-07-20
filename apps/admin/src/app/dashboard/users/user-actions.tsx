"use client";

import { banUserAction, unbanUserAction } from "@/lib/actions";
import { useTransition } from "react";

export function UserActions({
  userId,
  isBanned,
}: {
  userId: number;
  isBanned: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  const handleToggleBan = () => {
    startTransition(async () => {
      if (isBanned) {
        await unbanUserAction(userId);
      } else {
        if (confirm("Ban this user? They will lose access immediately.")) {
          await banUserAction(userId);
        }
      }
      window.location.reload();
    });
  };

  return (
    <button
      onClick={handleToggleBan}
      disabled={isPending}
      className={`btn btn-sm ${isBanned ? "btn-success" : "btn-danger"}`}
    >
      {isPending ? "..." : isBanned ? "Unban" : "Ban"}
    </button>
  );
}
