import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/session";
import { logoutAction } from "@/lib/actions";
import Link from "next/link";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireAuth();
  } catch {
    redirect("/login");
  }

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">⚡ Shén Zhèn</div>
        <ul className="sidebar-nav">
          <li>
            <Link href="/dashboard">📊 Dashboard</Link>
          </li>
          <li>
            <Link href="/dashboard/users">👥 Users</Link>
          </li>
          <li>
            <Link href="/dashboard/tasks">📋 Tasks</Link>
          </li>
          <li>
            <Link href="/dashboard/submissions">✅ Submissions</Link>
          </li>
          <li>
            <Link href="/dashboard/broadcasts">📡 Broadcasts</Link>
          </li>
          <li>
            <Link href="/dashboard/sybil">🛡️ Sybil Flags</Link>
          </li>
        </ul>
        <form action={logoutAction}>
          <button type="submit" className="btn btn-ghost btn-full btn-sm">
            🚪 Logout
          </button>
        </form>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
