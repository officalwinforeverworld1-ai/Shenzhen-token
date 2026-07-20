/**
 * Leaderboard Page — Premium rank display with podium, medals, and your rank
 */

import { useState, useEffect } from "react";
import {
  getLeaderboard,
  type LeaderboardResponse,
} from "../api";

interface Props {
  userId: number;
}

export function LeaderboardPage({ userId }: Props) {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  async function loadLeaderboard() {
    try {
      const result = await getLeaderboard();
      if (result.success) {
        setData(result.data);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="rank-page">
        <div className="page-header">
          <div>
            <div className="page-title">🏆 Leaderboard</div>
            <div className="page-subtitle">Loading...</div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <div className="splash-spinner" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rank-page">
        <div className="page-header">
          <div>
            <div className="page-title">🏆 Leaderboard</div>
            <div className="page-subtitle">Could not load</div>
          </div>
        </div>
        <div className="tasks-empty">
          <div style={{ fontSize: 48, marginBottom: 12 }}>😵</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Connection Error</div>
        </div>
      </div>
    );
  }

  const top3 = data.entries.slice(0, 3);
  const rest = data.entries.slice(3);

  // Reorder podium: [2nd, 1st, 3rd]
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);

  const getMedal = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  };

  const getInitial = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  return (
    <div className="rank-page animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">🏆 Leaderboard</div>
          <div className="page-subtitle">
            {data.totalUsers.toLocaleString()} participants
          </div>
        </div>
      </div>

      {/* Your Rank Card */}
      {data.userRank && (
        <div className="rank-your-card">
          <div className="rank-your-left">
            <div className="rank-your-position">#{data.userRank.rank}</div>
            <div className="rank-your-info">
              <div className="rank-your-label">Your Rank</div>
              <div className="rank-your-pts">
                {data.userRank.totalPoints.toLocaleString()} pts
              </div>
            </div>
          </div>
          <div className="rank-your-badge">
            {data.userRank.rank <= 10 ? "🔥" : data.userRank.rank <= 50 ? "⭐" : "💪"}
          </div>
        </div>
      )}

      {/* Podium — Top 3 */}
      {top3.length >= 3 && (
        <div className="rank-podium">
          {podiumOrder.map((entry) => {
            if (!entry) return null;
            const isFirst = entry.rank === 1;
            return (
              <div
                key={entry.userId}
                className={`rank-podium-item ${isFirst ? "rank-first" : ""}`}
              >
                <div className="rank-podium-medal">{getMedal(entry.rank)}</div>
                <div
                  className={`rank-podium-avatar ${
                    entry.rank === 1
                      ? "rank-avatar-gold"
                      : entry.rank === 2
                        ? "rank-avatar-silver"
                        : "rank-avatar-bronze"
                  }`}
                >
                  {getInitial(entry.firstName || entry.username || "?")}
                </div>
                <div className="rank-podium-name">
                  {entry.userId === userId
                    ? "You"
                    : entry.username
                      ? `@${entry.username}`
                      : entry.firstName}
                </div>
                <div className="rank-podium-pts">
                  {entry.totalPoints.toLocaleString()}
                </div>
                <div
                  className="rank-podium-bar"
                  style={{
                    height: entry.rank === 1 ? 80 : entry.rank === 2 ? 56 : 40,
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Rest of Leaderboard */}
      {rest.length > 0 && (
        <div className="rank-list">
          {rest.map((entry) => {
            const isMe = entry.userId === userId;
            return (
              <div
                key={entry.userId}
                className={`rank-row ${isMe ? "rank-row-me" : ""}`}
              >
                <div className="rank-row-pos">{entry.rank}</div>
                <div className="rank-row-avatar">
                  {getInitial(entry.firstName || entry.username || "?")}
                </div>
                <div className="rank-row-name">
                  {isMe
                    ? "You"
                    : entry.username
                      ? `@${entry.username}`
                      : entry.firstName}
                </div>
                <div className="rank-row-pts">
                  {entry.totalPoints.toLocaleString()}
                  <span className="rank-row-label"> pts</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty */}
      {data.entries.length === 0 && (
        <div className="tasks-empty">
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏁</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
            No entries yet
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            Be the first to earn points!
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="rank-footer">
        Top 100 earners shown · Updated in real-time
      </div>
    </div>
  );
}
