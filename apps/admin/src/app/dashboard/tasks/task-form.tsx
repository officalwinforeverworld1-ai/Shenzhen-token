"use client";

import { createTaskAction } from "@/lib/actions";
import { useState, useTransition } from "react";

export function TaskForm() {
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState("auto_channel");
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createTaskAction(formData);
      if (result.success) {
        setMessage("Task created!");
        (e.target as HTMLFormElement).reset();
        setTimeout(() => window.location.reload(), 500);
      } else {
        setMessage(result.error ?? "Failed to create task");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {message && (
        <div className={`alert ${message.includes("created") ? "alert-success" : "alert-error"}`}>
          {message}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div className="form-group">
          <label>Title</label>
          <input name="title" type="text" required placeholder="Join our channel" />
        </div>

        <div className="form-group">
          <label>Type</label>
          <select name="type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="auto_channel">Auto — Channel Join</option>
            <option value="auto_quiz">Auto — Quiz</option>
            <option value="manual">Manual Review</option>
          </select>
        </div>
      </div>

      <div className="form-group">
        <label>Description</label>
        <textarea name="description" required placeholder="Join our Telegram channel to earn points" rows={2} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
        <div className="form-group">
          <label>Point Reward</label>
          <input name="pointReward" type="number" required min={1} defaultValue={100} />
        </div>

        <div className="form-group">
          <label>Repeatable</label>
          <select name="isRepeatable">
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </div>

        {type === "auto_channel" && (
          <div className="form-group">
            <label>Channel ID</label>
            <input name="channelId" type="text" placeholder="@channelname" />
          </div>
        )}

        {type === "auto_quiz" && (
          <div className="form-group">
            <label>Quiz Answer</label>
            <input name="quizAnswer" type="text" placeholder="correct answer" />
          </div>
        )}
      </div>

      <button type="submit" className="btn btn-primary" disabled={isPending}>
        {isPending ? "Creating..." : "Create Task"}
      </button>
    </form>
  );
}
