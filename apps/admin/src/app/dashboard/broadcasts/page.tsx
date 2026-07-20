import { getBroadcasts } from "@shen-zhen/core";
import { BroadcastForm } from "./broadcast-form";

export const dynamic = "force-dynamic";

export default async function BroadcastsPage() {
  const { broadcasts, total } = await getBroadcasts(20, 0);

  return (
    <>
      <div className="page-header">
        <h1>Broadcasts</h1>
      </div>

      {/* Send Broadcast */}
      <div className="table-container" style={{ marginBottom: "2rem" }}>
        <div className="table-header">
          <h2>Send New Broadcast</h2>
        </div>
        <div style={{ padding: "1.5rem" }}>
          <BroadcastForm />
        </div>
      </div>

      {/* Broadcast History */}
      <div className="table-container">
        <div className="table-header">
          <h2>History ({total})</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Message</th>
              <th>Status</th>
              <th>Sent</th>
              <th>Failed</th>
              <th>Total</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {broadcasts.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <p>No broadcasts sent yet</p>
                  </div>
                </td>
              </tr>
            ) : (
              broadcasts.map((bc) => (
                <tr key={bc.id}>
                  <td>#{bc.id}</td>
                  <td style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {bc.message}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        bc.status === "completed"
                          ? "badge-success"
                          : bc.status === "sending"
                            ? "badge-warning"
                            : bc.status === "cancelled"
                              ? "badge-danger"
                              : "badge-info"
                      }`}
                    >
                      {bc.status}
                    </span>
                  </td>
                  <td>{bc.sentCount.toLocaleString()}</td>
                  <td style={{ color: bc.failedCount > 0 ? "var(--danger)" : "inherit" }}>
                    {bc.failedCount.toLocaleString()}
                  </td>
                  <td>{bc.totalUsers.toLocaleString()}</td>
                  <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    {bc.createdAt.toLocaleString()}
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
