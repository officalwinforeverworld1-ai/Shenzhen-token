"use client";

import { sendBroadcastAction } from "@/lib/actions";
import { useState, useTransition } from "react";

export function BroadcastForm() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim()) return;
    if (!confirm(`Send this broadcast to ALL users?\n\n"${message.slice(0, 100)}..."`)) return;

    startTransition(async () => {
      const result = await sendBroadcastAction(message);
      if (result.success) {
        setFeedback(`Broadcast #${result.broadcastId} queued!`);
        setMessage("");
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setFeedback(result.error ?? "Failed");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {feedback && (
        <div className={`alert ${feedback.includes("queued") ? "alert-success" : "alert-error"}`}>
          {feedback}
        </div>
      )}

      <div className="form-group">
        <label>Message</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your broadcast message here... (supports Markdown)"
          rows={4}
          required
        />
      </div>

      <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
        <button type="submit" className="btn btn-primary" disabled={isPending || !message.trim()}>
          {isPending ? "Queuing..." : "📡 Send Broadcast"}
        </button>
        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
          ⚠️ This will send to ALL active users
        </span>
      </div>
    </form>
  );
}
