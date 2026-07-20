/**
 * Upgrades (Boost) Screen — Premium design with $SHEN branding
 * Spend $SHEN to boost tap power, energy capacity, and regen rate.
 */

import { useState, useEffect } from "react";
import {
  getUpgrades,
  purchaseUpgrade,
  type UpgradeView,
  type UserProfile,
} from "../api";

interface Props {
  user: UserProfile;
  updateUser: (updates: Partial<UserProfile>) => void;
}

export function UpgradesPage({ user, updateUser }: Props) {
  const [upgrades, setUpgrades] = useState<UpgradeView[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<number | null>(null);
  const [successId, setSuccessId] = useState<number | null>(null);

  useEffect(() => {
    loadUpgrades();
  }, []);

  async function loadUpgrades() {
    try {
      const result = await getUpgrades();
      if (result.success) {
        setUpgrades(result.data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function handleBuy(upgradeId: number) {
    setBuying(upgradeId);
    try {
      const result = await purchaseUpgrade(upgradeId);
      if (result.success) {
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
        updateUser({ balance: result.newBalance });
        setSuccessId(upgradeId);
        setTimeout(() => setSuccessId(null), 1500);
        await loadUpgrades();
      }
    } catch {
      // silent
    } finally {
      setBuying(null);
    }
  }

  if (loading) {
    return (
      <div className="loading-screen" style={{ minHeight: "50vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="boost-page">
      {/* Balance card */}
      <div className="boost-balance-card">
        <div className="boost-balance-label">Available Balance</div>
        <div className="boost-balance-amount">
          <span className="boost-coin">🪙</span>
          {user.balance.toLocaleString()} <span className="boost-token">$SHEN</span>
        </div>
      </div>

      {/* Current stats */}
      <div className="boost-current-stats">
        <div className="boost-stat">
          <span className="boost-stat-icon">💥</span>
          <span className="boost-stat-val">{user.tapPower}</span>
          <span className="boost-stat-lbl">Tap Power</span>
        </div>
        <div className="boost-stat">
          <span className="boost-stat-icon">🔋</span>
          <span className="boost-stat-val">{user.energy.max}</span>
          <span className="boost-stat-lbl">Max Energy</span>
        </div>
        <div className="boost-stat">
          <span className="boost-stat-icon">⚡</span>
          <span className="boost-stat-val">{user.energy.regenRate}/s</span>
          <span className="boost-stat-lbl">Regen</span>
        </div>
      </div>

      {/* Upgrades list */}
      <div className="boost-section-title">Available Upgrades</div>

      {upgrades.length === 0 ? (
        <div className="empty">
          <div className="empty-emoji">🔧</div>
          <p>No upgrades available yet</p>
        </div>
      ) : (
        <div className="boost-list">
          {upgrades.map((upgrade) => {
            const isMaxed = upgrade.currentLevel >= upgrade.maxLevel;
            const isSuccess = successId === upgrade.id;
            const levelPct = Math.round((upgrade.currentLevel / upgrade.maxLevel) * 100);

            return (
              <div
                key={upgrade.id}
                className={`boost-card ${isMaxed ? "boost-maxed" : ""} ${isSuccess ? "boost-success" : ""}`}
              >
                <div className="boost-card-top">
                  <div className="boost-card-icon">{upgrade.iconEmoji}</div>
                  <div className="boost-card-info">
                    <div className="boost-card-name">{upgrade.name}</div>
                    <div className="boost-card-desc">{upgrade.description}</div>
                    <div className="boost-card-level">
                      Lv. {upgrade.currentLevel}/{upgrade.maxLevel}
                      {upgrade.currentEffect > 0 && (
                        <span className="boost-card-effect"> • +{upgrade.currentEffect}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Level progress bar */}
                <div className="boost-progress-wrap">
                  <div className="boost-progress-fill" style={{ width: `${levelPct}%` }} />
                </div>

                {/* Action */}
                {isMaxed ? (
                  <div className="boost-maxed-badge">✅ MAX LEVEL</div>
                ) : (
                  <button
                    className={`boost-buy-btn ${!upgrade.canAfford ? "boost-cant-afford" : ""}`}
                    disabled={!upgrade.canAfford || buying === upgrade.id}
                    onClick={() => handleBuy(upgrade.id)}
                  >
                    {buying === upgrade.id ? (
                      <span className="boost-buy-spinner">⏳</span>
                    ) : (
                      <>
                        <span className="boost-buy-label">Upgrade</span>
                        <span className="boost-buy-cost">
                          {upgrade.nextCost?.toLocaleString()} $SHEN
                        </span>
                      </>
                    )}
                  </button>
                )}

                {upgrade.nextEffect && !isMaxed && (
                  <div className="boost-next-hint">
                    Next: +{upgrade.nextEffect} {upgrade.type === "tap_power" ? "per tap" : upgrade.type === "max_energy" ? "capacity" : "per second"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
