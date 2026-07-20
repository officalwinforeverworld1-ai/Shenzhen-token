import { getPendingSubmissions } from "@shen-zhen/core";
import { SubmissionActions } from "./submission-actions";

export const dynamic = "force-dynamic";

export default async function SubmissionsPage() {
  const { submissions, total } = await getPendingSubmissions(50, 0);

  return (
    <>
      <div className="page-header">
        <h1>Pending Submissions ({total})</h1>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Task</th>
              <th>Reward</th>
              <th>Proof</th>
              <th>Submitted</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {submissions.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <p>🎉 No pending submissions — all caught up!</p>
                  </div>
                </td>
              </tr>
            ) : (
              submissions.map((sub) => (
                <tr key={sub.id}>
                  <td>#{sub.id}</td>
                  <td>
                    {sub.user.username ? `@${sub.user.username}` : sub.user.firstName}
                    <br />
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      ID: {sub.user.id}
                    </span>
                  </td>
                  <td>
                    <strong>{sub.task.title}</strong>
                    <br />
                    <span className="badge badge-info" style={{ marginTop: "0.25rem" }}>
                      {sub.task.type}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{sub.task.pointReward} pts</td>
                  <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {sub.proof ?? "—"}
                  </td>
                  <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    {sub.createdAt.toLocaleString()}
                  </td>
                  <td>
                    <SubmissionActions submissionId={sub.id} />
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
