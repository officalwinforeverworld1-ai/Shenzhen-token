/**
 * Friends Page — Premium referral system with invite hero, stats, and friend list
 */

import { useState, useEffect } from "react";
import { getReferrals, type ReferralStats } from "../api";

export function FriendsPage() {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const result = await getReferrals();
      if (result.success) {
        setStats(result.data);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!stats) return;
    try {
      await navigator.clipboard.writeText(stats.referralLink);
    } catch {
      const input = document.createElement("input");
      input.value = stats.referralLink;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred("light");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleShare() {
    if (!stats) return;
    const text = encodeURIComponent(
      "🔥 Join Shén Zhèn Airdrop — Earn crypto by tapping! ⚡\n\nUse my invite link:",
    );
    const url = encodeURIComponent(stats.referralLink);
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, "_blank");
  }

  if (loading) {
    return (
      <div className="friends-page">
        <div className="page-header">
          <div>
            <div className="page-title">👥 Friends</div>
            <div className="page-subtitle">Loading...</div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <div className="splash-spinner" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="friends-page">
        <div className="page-header">
          <div>
            <div className="page-title">👥 Friends</div>
            <div className="page-subtitle">Could not load referral data</div>
          </div>
        </div>
        <div className="tasks-empty">
          <div style={{ fontSize: 48, marginBottom: 12 }}>😵</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Connection Error</div>
          <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            Please try again later
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="friends-page animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">👥 Invite Friends</div>
          <div className="page-subtitle">Earn 500 pts per friend!</div>
        </div>
      </div>

      {/* Invite Hero Card */}
      <div className="friends-hero">
        <div className="friends-hero-icon">🎁</div>
        <div className="friends-hero-title">Invite & Earn Together</div>
        <div className="friends-hero-desc">
          Share your link → Friends join → Both earn points!
        </div>
        <div className="friends-hero-reward">
          <span className="friends-reward-amount">+500</span>
          <span className="friends-reward-label">pts per friend</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="friends-actions">
        <button className="friends-share-btn" onClick={handleShare}>
          <span>📤</span> Share via Telegram
        </button>
        <button className="friends-copy-btn" onClick={handleCopy}>
          <span>{copied ? "✅" : "📋"}</span> {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>

      {/* Referral Link Preview */}
      <div className="friends-link-box">
        <div className="friends-link-label">Your Invite Link</div>
        <div className="friends-link-text">{stats.referralLink}</div>
      </div>

      {/* Stats Grid */}
      <div className="friends-stats">
        <div className="friends-stat-card">
          <div className="friends-stat-icon">👥</div>
          <div className="friends-stat-num">{stats.totalReferred}</div>
          <div className="friends-stat-label">Total Invited</div>
        </div>
        <div className="friends-stat-card">
          <div className="friends-stat-icon">✅</div>
          <div className="friends-stat-num">{stats.qualifiedCount}</div>
          <div className="friends-stat-label">Qualified</div>
        </div>
        <div className="friends-stat-card">
          <div className="friends-stat-icon">⏳</div>
          <div className="friends-stat-num">{stats.pendingCount}</div>
          <div className="friends-stat-label">Pending</div>
        </div>
        <div className="friends-stat-card">
          <div className="friends-stat-icon">🪙</div>
          <div className="friends-stat-num">{stats.totalEarned.toLocaleString()}</div>
          <div className="friends-stat-label">Pts Earned</div>
        </div>
      </div>

      {/* How It Works */}
      <div className="friends-how">
        <div className="friends-how-title">💡 How It Works</div>
        <div className="friends-how-steps">
          <div className="friends-step">
            <div className="friends-step-num">1</div>
            <div className="friends-step-text">Share your unique invite link</div>
          </div>
          <div className="friends-step">
            <div className="friends-step-num">2</div>
            <div className="friends-step-text">Friend joins via your link</div>
          </div>
          <div className="friends-step">
            <div className="friends-step-num">3</div>
            <div className="friends-step-text">Both of you earn bonus points!</div>
          </div>
        </div>
      </div>
    </div>
  );
}
