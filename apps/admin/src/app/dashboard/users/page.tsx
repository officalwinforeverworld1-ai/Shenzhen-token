import { prisma } from "@shen-zhen/database";
import { getBalance } from "@shen-zhen/core";
import { UserActions } from "./user-actions";

export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = params.q ?? "";
  const page = parseInt(params.page ?? "1", 10);
  const limit = 25;
  const offset = (page - 1) * limit;

  const where = query
    ? {
        OR: [
          { username: { contains: query, mode: "insensitive" as const } },
          { firstName: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.user.count({ where }),
  ]);

  // Fetch balances for all users
  const balances = await Promise.all(
    users.map((u) => getBalance(u.id)),
  );

  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <div className="page-header">
        <h1>Users ({total.toLocaleString()})</h1>
      </div>

      {/* Search */}
      <form style={{ marginBottom: "1.5rem" }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <input
            name="q"
            type="text"
            placeholder="Search by username or name..."
            defaultValue={query}
            style={{ maxWidth: 400 }}
          />
        </div>
      </form>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Telegram ID</th>
              <th>Username</th>
              <th>Name</th>
              <th>Balance</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">
                    <p>No users found</p>
                  </div>
                </td>
              </tr>
            ) : (
              users.map((user, i) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                    {user.telegramId.toString()}
                  </td>
                  <td>{user.username ? `@${user.username}` : "—"}</td>
                  <td>{user.firstName} {user.lastName ?? ""}</td>
                  <td style={{ fontWeight: 600 }}>
                    {balances[i]?.toLocaleString() ?? 0}
                  </td>
                  <td>
                    {user.isBanned ? (
                      <span className="badge badge-danger">Banned</span>
                    ) : user.isVerified ? (
                      <span className="badge badge-success">Verified</span>
                    ) : (
                      <span className="badge badge-warning">Unverified</span>
                    )}
                  </td>
                  <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    {user.createdAt.toLocaleDateString()}
                  </td>
                  <td>
                    <UserActions userId={user.id} isBanned={user.isBanned} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
          {page > 1 && (
            <a href={`/dashboard/users?q=${query}&page=${page - 1}`} className="btn btn-ghost btn-sm">
              ← Prev
            </a>
          )}
          <span style={{ padding: "0.4rem 0.8rem", color: "var(--text-muted)" }}>
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <a href={`/dashboard/users?q=${query}&page=${page + 1}`} className="btn btn-ghost btn-sm">
              Next →
            </a>
          )}
        </div>
      )}
    </>
  );
}
