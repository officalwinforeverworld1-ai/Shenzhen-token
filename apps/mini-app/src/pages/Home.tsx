/**
 * Earn Page — Premium tap-to-earn with live energy regen,
 * floating particles, haptic feedback, and debounced server sync.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { UserProfile, EnergyState } from "../api";
import { tap } from "../api";

/* ── Types ──────────────────────────────────────────────── */
interface FloatParticle {
  id: number;
  x: number;
  y: number;
  value: number;
}

interface Props {
  user: UserProfile;
  updateUser: (u: Partial<UserProfile>) => void;
  updateEnergy: (e: EnergyState) => void;
  onNavigate: (page: "home" | "tasks" | "friends" | "leaderboard" | "upgrades" | "games") => void;
}

let particleId = 0;

/* ── Component ──────────────────────────────────────────── */
export function HomePage({ user, updateUser, updateEnergy, onNavigate }: Props) {
  const [particles, setParticles] = useState<FloatParticle[]>([]);
  const [localBalance, setLocalBalance] = useState(user.balance);
  const [localEnergy, setLocalEnergy] = useState(user.energy.current);
  const [pressed, setPressed] = useState(false);
  const tapBuffer = useRef(0);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync balance from parent when server responds
  useEffect(() => {
    setLocalBalance(user.balance);
  }, [user.balance]);

  useEffect(() => {
    setLocalEnergy(user.energy.current);
  }, [user.energy.current]);

  // ── Live energy regeneration (client-side tick) ──────
  useEffect(() => {
    if (localEnergy >= user.energy.max) return;

    const regenPerTick = user.energy.regenRate; // pts per second
    const interval = setInterval(() => {
      setLocalEnergy((e) => Math.min(e + regenPerTick, user.energy.max));
    }, 1000);

    return () => clearInterval(interval);
  }, [localEnergy >= user.energy.max, user.energy.max, user.energy.regenRate]);

  const energyPct = Math.min(100, Math.round((localEnergy / user.energy.max) * 100));

  // ── Tap Handler ─────────────────────────────────────────
  const handleTap = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (localEnergy <= 0) return;

      // Position for particle
      let x = 0, y = 0;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      if ("touches" in e && e.touches[0]) {
        x = e.touches[0].clientX - rect.left;
        y = e.touches[0].clientY - rect.top;
      } else if ("clientX" in e) {
        x = (e as React.MouseEvent).clientX - rect.left;
        y = (e as React.MouseEvent).clientY - rect.top;
      }

      // Haptic
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred("light");

      // Spawn floating +N
      const pid = particleId++;
      const jitterX = x + (Math.random() - 0.5) * 60;
      setParticles((prev) => [
        ...prev.slice(-10),
        { id: pid, x: jitterX, y: y - 10, value: user.tapPower },
      ]);
      setTimeout(() => setParticles((p) => p.filter((v) => v.id !== pid)), 900);

      // Optimistic updates
      setLocalBalance((b) => b + user.tapPower);
      setLocalEnergy((e) => Math.max(0, e - 1));
      tapBuffer.current += 1;

      // Debounced flush (300ms)
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(async () => {
        const count = tapBuffer.current;
        tapBuffer.current = 0;
        try {
          const res = await tap(count);
          if (res.success) {
            updateUser({ balance: res.data.balance });
            updateEnergy(res.data.energy);
          }
        } catch {
          /* silent — optimistic UI handles it */
        }
      }, 300);
    },
    [localEnergy, user.tapPower, updateUser, updateEnergy],
  );

  // ── Render ──────────────────────────────────────────────
  const formattedBalance = localBalance.toLocaleString();

  return (
    <div className="earn-page">
      {/* ── Header: balance + level ── */}
      <div className="earn-header">
        <div className="earn-level-badge">
          <span className="earn-level-icon">⚡</span>
          <span className="earn-level-text">
            {user.tapPower >= 5 ? "Power Tapper" : user.tapPower >= 3 ? "Fast Tapper" : "Tapper"}
          </span>
        </div>

        <div className="earn-balance-wrap">
          <span className="earn-coin-icon">🪙</span>
          <span className="earn-balance">{formattedBalance}</span>
        </div>

        <div className="earn-subtitle">Tap the coin to earn $SHEN</div>
      </div>

      {/* ── Coin Tap Area ── */}
      <div className="earn-tap-zone">
        <div className="earn-coin-wrap">
          {/* Animated rings */}
          <div className="earn-ring earn-ring-1" />
          <div className="earn-ring earn-ring-2" />
          <div className="earn-ring earn-ring-3" />

          <button
            className={`earn-coin-btn ${pressed ? "pressed" : ""} ${localEnergy <= 0 ? "depleted" : ""}`}
            onPointerDown={() => setPressed(true)}
            onPointerUp={() => setPressed(false)}
            onPointerLeave={() => setPressed(false)}
            onTouchStart={(e) => { setPressed(true); handleTap(e); }}
            onTouchEnd={() => setPressed(false)}
            onClick={handleTap}
            disabled={localEnergy <= 0}
          >
            <span className="earn-coin-emoji">🪙</span>
            <span className="earn-tap-power">+{user.tapPower}</span>
          </button>

          {/* Floating particles */}
          {particles.map((p) => (
            <div
              key={p.id}
              className="float-point"
              style={{ left: p.x, top: p.y }}
            >
              +{p.value}
            </div>
          ))}
        </div>

        {localEnergy <= 0 && (
          <div className="earn-depleted-msg">
            ⚡ Energy depleted — recharging...
          </div>
        )}
      </div>

      {/* ── Energy Bar ── */}
      <div className="earn-energy">
        <div className="earn-energy-header">
          <div className="earn-energy-left">
            <span className="earn-energy-bolt">⚡</span>
            <span className="earn-energy-nums">
              {Math.round(localEnergy)}<span className="earn-energy-max">/{user.energy.max}</span>
            </span>
          </div>
          <div className="earn-energy-regen">
            +{user.energy.regenRate}/s
          </div>
        </div>
        <div className="earn-energy-track">
          <div className="earn-energy-fill" style={{ width: `${energyPct}%` }} />
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="earn-stats">
        <div className="earn-stat-card">
          <div className="earn-stat-num">{user.tapPower}</div>
          <div className="earn-stat-label">Tap Power</div>
        </div>
        <div className="earn-stat-card">
          <div className="earn-stat-num">{user.energy.max}</div>
          <div className="earn-stat-label">Max Energy</div>
        </div>
        <div className="earn-stat-card">
          <div className="earn-stat-num">{user.energy.regenRate}/s</div>
          <div className="earn-stat-label">Regen</div>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="earn-quick-actions">
        <button className="earn-quick-btn" onClick={() => onNavigate("games")}>
          <span className="earn-quick-icon">🎰</span>
          <span className="earn-quick-label">Games</span>
        </button>
        <button className="earn-quick-btn" onClick={() => onNavigate("tasks")}>
          <span className="earn-quick-icon">📋</span>
          <span className="earn-quick-label">Tasks</span>
        </button>
        <button className="earn-quick-btn" onClick={() => onNavigate("friends")}>
          <span className="earn-quick-icon">👥</span>
          <span className="earn-quick-label">Friends</span>
        </button>
      </div>

      {/* ── Boost CTA ── */}
      <div className="earn-boost-banner" onClick={() => onNavigate("upgrades")} style={{ cursor: "pointer" }}>
        <div className="earn-boost-left">
          <span style={{ fontSize: 28 }}>🚀</span>
          <div>
            <div className="earn-boost-title">Boost your earnings</div>
            <div className="earn-boost-desc">Upgrade tap power & energy</div>
          </div>
        </div>
        <div className="earn-boost-arrow">→</div>
      </div>
    </div>
  );
}
