import { prisma } from "@shen-zhen/database";
import { TaskForm } from "./task-form";
import { TaskActions } from "./task-actions";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const tasks = await prisma.task.findMany({
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }],
  });

  // Count submissions per task
  const submissionCounts = await prisma.taskSubmission.groupBy({
    by: ["taskId"],
    where: { status: { in: ["approved", "auto_approved"] } },
    _count: true,
  });

  const countMap = new Map(submissionCounts.map((s) => [s.taskId, s._count]));

  return (
    <>
      <div className="page-header">
        <h1>Tasks</h1>
      </div>

      {/* Create Task Form */}
      <div className="table-container" style={{ marginBottom: "2rem" }}>
        <div className="table-header">
          <h2>Create New Task</h2>
        </div>
        <div style={{ padding: "1.5rem" }}>
          <TaskForm />
        </div>
      </div>

      {/* Task List */}
      <div className="table-container">
        <div className="table-header">
          <h2>All Tasks ({tasks.length})</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Reward</th>
              <th>Completions</th>
              <th>Repeatable</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <p>No tasks created yet</p>
                  </div>
                </td>
              </tr>
            ) : (
              tasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    <strong>{task.title}</strong>
                    <br />
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {task.description.slice(0, 60)}
                      {task.description.length > 60 ? "..." : ""}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-info">{task.type}</span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{task.pointReward} pts</td>
                  <td>{countMap.get(task.id) ?? 0}</td>
                  <td>{task.isRepeatable ? "✅" : "—"}</td>
                  <td>
                    {task.isActive ? (
                      <span className="badge badge-success">Active</span>
                    ) : (
                      <span className="badge badge-danger">Inactive</span>
                    )}
                  </td>
                  <td>
                    <TaskActions taskId={task.id} isActive={task.isActive} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
