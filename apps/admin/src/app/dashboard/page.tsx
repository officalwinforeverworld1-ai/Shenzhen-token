import { prisma } from "@shen-zhen/database";
import { getUnresolvedFlags, getPendingSubmissions } from "@shen-zhen/core";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Fetch all stats in parallel
  const [
    totalUsers,
    verifiedUsers,
    bannedUsers,
    totalTasks,
    totalReferrals,
    qualifiedReferrals,
    pendingSubs,
    unresolvedFlags,
    todayUsers,
    totalPointsResult,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isVerified: true } }),
    prisma.user.count({ where: { isBanned: true } }),
    prisma.task.count({ where: { isActive: true } }),
    prisma.referral.count(),
    prisma.referral.count({ where: { status: { in: ["qualified", "rewarded"] } } }),
    getPendingSubmissions(1, 0),
    getUnresolvedFlags(1, 0),
    prisma.user.count({
      where: {
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
    prisma.pointLedger.aggregate({ _sum: { amount: true } }),
  ]);

  const totalPoints = totalPointsResult._sum.amount ?? 0;

  return (
    <>
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Users</div>
          <div className="stat-value">{totalUsers.toLocaleString()}</div>
          <div className="stat-change positive">+{todayUsers} today</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Verified Users</div>
          <div className="stat-value">{verifiedUsers.toLocaleString()}</div>
          <div className="stat-change">
            {totalUsers > 0
              ? ((verifiedUsers / totalUsers) * 100).toFixed(1)
              : 0}
            % rate
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Points Issued</div>
          <div className="stat-value">{totalPoints.toLocaleString()}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Active Tasks</div>
          <div className="stat-value">{totalTasks}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Referrals</div>
          <div className="stat-value">{totalReferrals.toLocaleString()}</div>
          <div className="stat-change positive">
            {qualifiedReferrals} qualified
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Banned Users</div>
          <div className="stat-value">{bannedUsers}</div>
        </div>
      </div>

      {/* Action Items */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">⏳ Pending Submissions</div>
          <div className="stat-value">{pendingSubs.total}</div>
          {pendingSubs.total > 0 && (
            <a href="/dashboard/submissions" className="stat-change" style={{ color: "var(--warning)" }}>
              Review now →
            </a>
          )}
        </div>

        <div className="stat-card">
          <div className="stat-label">🛡️ Sybil Flags</div>
          <div className="stat-value">{unresolvedFlags.total}</div>
          {unresolvedFlags.total > 0 && (
            <a href="/dashboard/sybil" className="stat-change" style={{ color: "var(--danger)" }}>
              Review now →
            </a>
          )}
        </div>
      </div>
    </>
  );
}
