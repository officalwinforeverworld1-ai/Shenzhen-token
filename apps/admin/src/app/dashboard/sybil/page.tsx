import { getUnresolvedFlags } from "@shen-zhen/core";
import { FlagActions } from "./flag-actions";

export const dynamic = "force-dynamic";

export default async function SybilPage() {
  const { flags, total } = await getUnresolvedFlags(50, 0);

  return (
    <>
      <div className="page-header">
        <h1>🛡️ Sybil Flags ({total})</h1>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Flag Type</th>
              <th>Severity</th>
              <th>Details</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {flags.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <p>🎉 No unresolved sybil flags — community looks clean!</p>
                  </div>
                </td>
              </tr>
            ) : (
              flags.map((flag) => {
                const details = flag.details as Record<string, unknown> | null;
                return (
                  <tr key={flag.id}>
                    <td>#{flag.id}</td>
                    <td>
                      {flag.user.username ? `@${flag.user.username}` : flag.user.firstName}
                      <br />
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        ID: {flag.user.id} | TG: {flag.user.telegramId.toString()}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-info">
                        {flag.flagType.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          flag.severity === "high"
                            ? "badge-danger"
                            : flag.severity === "medium"
                              ? "badge-warning"
                              : "badge-info"
                        }`}
                      >
                        {flag.severity}
                      </span>
                    </td>
                    <td style={{ maxWidth: 250, fontSize: "0.8rem" }}>
                      {details && (
                        <pre
                          style={{
                            background: "var(--bg-input)",
                            padding: "0.5rem",
                            borderRadius: "6px",
                            overflow: "auto",
                            maxHeight: 100,
                            fontSize: "0.7rem",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {JSON.stringify(details, null, 2)}
                        </pre>
                      )}
                    </td>
                    <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      {flag.createdAt.toLocaleString()}
                    </td>
                    <td>
                      <FlagActions flagId={flag.id} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
