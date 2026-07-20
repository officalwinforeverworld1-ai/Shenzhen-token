/**
 * Tasks Page — Premium task list with categories, progress, and rewards
 */

import { useState, useEffect } from "react";
import {
  getTasks,
  submitTaskCompletion,
  type TaskView,
  type UserProfile,
} from "../api";

interface Props {
  user: UserProfile;
  updateUser: (updates: Partial<UserProfile>) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  auto_channel: "📢",
  auto_quiz: "❓",
  manual_screenshot: "📸",
  social_follow: "🔗",
  social_like: "❤️",
  social_share: "🔄",
  default: "⭐",
};

const CATEGORY_LABELS: Record<string, string> = {
  auto_channel: "Channel",
  auto_quiz: "Quiz",
  manual_screenshot: "Verify",
  social_follow: "Social",
  social_like: "Social",
  social_share: "Social",
};

export function TasksPage({ user, updateUser }: Props) {
  const [tasks, setTasks] = useState<TaskView[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [successId, setSuccessId] = useState<number | null>(null);

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    try {
      const result = await getTasks();
      if (result.success) {
        setTasks(result.data);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete(task: TaskView) {
    if (submitting) return;
    setSubmitting(task.id);
    try {
      const result = await submitTaskCompletion(task.id);
      if (result.success && result.pointsAwarded) {
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
        updateUser({ balance: user.balance + result.pointsAwarded });
        setSuccessId(task.id);
        setTimeout(() => setSuccessId(null), 2000);
        await loadTasks();
      }
    } catch {
      /* silent */
    } finally {
      setSubmitting(null);
    }
  }

  // Separate completed vs available
  const available = tasks.filter((t) => !t.isCompleted);
  const completed = tasks.filter((t) => t.isCompleted);
  const totalReward = available.reduce((s, t) => s + t.pointReward, 0);

  if (loading) {
    return (
      <div className="tasks-page">
        <div className="page-header">
          <div>
            <div className="page-title">📋 Tasks</div>
            <div className="page-subtitle">Loading...</div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <div className="splash-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="tasks-page animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">📋 Tasks</div>
          <div className="page-subtitle">Complete tasks to earn points</div>
        </div>
      </div>

      {/* Progress Banner */}
      <div className="tasks-progress-banner">
        <div className="tasks-progress-left">
          <div className="tasks-progress-circle">
            <span className="tasks-progress-num">{completed.length}</span>
            <span className="tasks-progress-total">/{tasks.length}</span>
          </div>
          <div>
            <div className="tasks-progress-label">Tasks Completed</div>
            <div className="tasks-progress-sub">
              {totalReward > 0 ? `+${totalReward.toLocaleString()} pts available` : "All done! 🎉"}
            </div>
          </div>
        </div>
        <div className="tasks-progress-bar-wrap">
          <div
            className="tasks-progress-bar-fill"
            style={{ width: `${tasks.length > 0 ? (completed.length / tasks.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Available Tasks */}
      {available.length > 0 && (
        <>
          <div className="section-title">🎯 Available ({available.length})</div>
          <div className="tasks-list">
            {available.map((task) => (
              <div
                key={task.id}
                className={`task-card ${successId === task.id ? "task-success" : ""}`}
              >
                <div className="task-icon-circle">
                  {CATEGORY_ICONS[task.type] ?? CATEGORY_ICONS["default"]}
                </div>
                <div className="task-content">
                  <div className="task-card-title">{task.title}</div>
                  <div className="task-card-desc">{task.description}</div>
                  <div className="task-card-tag">
                    {CATEGORY_LABELS[task.type] ?? "Task"}
                  </div>
                </div>
                <div className="task-action">
                  {successId === task.id ? (
                    <div className="task-claimed">✅</div>
                  ) : task.canSubmit ? (
                    <button
                      className="task-claim-btn"
                      disabled={submitting === task.id}
                      onClick={() => handleComplete(task)}
                    >
                      {submitting === task.id ? (
                        <span className="task-btn-spinner" />
                      ) : (
                        `+${task.pointReward}`
                      )}
                    </button>
                  ) : (
                    <div className="task-pending">⏳</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Completed Tasks */}
      {completed.length > 0 && (
        <>
          <div className="section-title" style={{ opacity: 0.6 }}>
            ✅ Completed ({completed.length})
          </div>
          <div className="tasks-list">
            {completed.map((task) => (
              <div key={task.id} className="task-card task-completed">
                <div className="task-icon-circle" style={{ opacity: 0.4 }}>
                  {CATEGORY_ICONS[task.type] ?? CATEGORY_ICONS["default"]}
                </div>
                <div className="task-content">
                  <div className="task-card-title">{task.title}</div>
                  <div className="task-card-desc">{task.description}</div>
                </div>
                <div className="task-done-badge">✓</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Empty State */}
      {tasks.length === 0 && (
        <div className="tasks-empty">
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>No tasks yet</div>
          <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            New tasks will appear here soon!
          </div>
        </div>
      )}
    </div>
  );
}
