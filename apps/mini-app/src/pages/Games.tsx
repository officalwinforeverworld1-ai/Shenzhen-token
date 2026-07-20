/**
 * Games Page — Spin Wheel + Daily Check-in hub
 */

import { useState, useEffect } from "react";
import type { UserProfile } from "../api";
import {
  spinWheel,
  getSpinStatus,
  dailyCheckin,
  getCheckinStatus,
} from "../api";

const WHEEL_SLICES = [
  { label: "10",      points: 10,   color: "#2d3436" },
  { label: "25",      points: 25,   color: "#00b894" },
  { label: "50",      points: 50,   color: "#0984e3" },
  { label: "100",     points: 100,  color: "#6c5ce7" },
  { label: "250",     points: 250,  color: "#fdcb6e" },
  { label: "500",     points: 500,  color: "#e17055" },
  { label: "1000",    points: 1000, color: "#d63031" },
  { label: "🎰 5000", points: 5000, color: "#ffd700" },
];

const STREAK_REWARDS: Record<number, number> = {
  1: 50, 2: 75, 3: 100, 4: 150, 5: 200, 6: 300, 7: 500,
};

interface Props {
  user: UserProfile;
  updateUser: (u: Partial<UserProfile>) => void;
}

type View = "hub" | "spin" | "daily";

export function GamesPage({ user, updateUser }: Props) {
  const [view, setView] = useState<View>("hub");

  return (
    <div className="games-page animate-fade-in">
      {view === "hub"  && <GamesHub  onSelect={setView} />}
      {view === "spin" && <SpinView user={user} updateUser={updateUser} onBack={() => setView("hub")} />}
      {view === "daily" && <DailyView user={user} updateUser={updateUser} onBack={() => setView("hub")} />}
    </div>
  );
}

/* ── Hub ─────────────────────────────────────────────────── */
function GamesHub({ onSelect }: { onSelect: (v: View) => void }) {
  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">🎮 Games</div>
          <div className="page-subtitle">Earn more points — play daily!</div>
        </div>
      </div>

      <div className="games-grid">
        <button className="game-card spin-card" onClick={() => onSelect("spin")}>
          <span className="game-badge badge-free">FREE</span>
          <div className="game-icon">🎰</div>
          <div className="game-name">Spin Wheel</div>
          <div className="game-desc">Free spin every 8h. Win up to 5,000 pts!</div>
        </button>

        <button className="game-card daily-card" onClick={() => onSelect("daily")}>
          <span className="game-badge badge-ready">DAILY</span>
          <div className="game-icon">📅</div>
          <div className="game-name">Check-in</div>
          <div className="game-desc">Streak bonuses up to 500 pts/day!</div>
        </button>

        <button className="game-card mystery-card" style={{ opacity: 0.5, cursor: "default" }}>
          <span className="game-badge" style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}>SOON</span>
          <div className="game-icon">🎁</div>
          <div className="game-name">Mystery Box</div>
          <div className="game-desc">Pick a box, win a prize!</div>
        </button>

        <button className="game-card streak-card" style={{ opacity: 0.5, cursor: "default" }}>
          <span className="game-badge" style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}>SOON</span>
          <div className="game-icon">🏅</div>
          <div className="game-name">Challenges</div>
          <div className="game-desc">Weekly challenges & big rewards!</div>
        </button>
      </div>
    </>
  );
}

/* ── Spin Wheel ──────────────────────────────────────────── */
function SpinView({ user, updateUser, onBack }: { user: UserProfile; updateUser: (u: Partial<UserProfile>) => void; onBack: () => void }) {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<{ points: number; label: string } | null>(null);
  const [canFreeSpin, setCanFreeSpin] = useState(true);
  const [nextSpinAt, setNextSpinAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSpinStatus()
      .then((res) => {
        if (res.success) {
          setCanFreeSpin(res.data.canFreeSpin);
          setNextSpinAt(res.data.nextFreeSpinAt);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const doSpin = async (type: "free" | "paid" = "free") => {
    if (spinning) return;
    setSpinning(true);
    setResult(null);

    try {
      const res = await spinWheel(type);

      if (!res.success || !res.data) {
        alert(res.error ?? "Spin failed");
        setSpinning(false);
        return;
      }

      const { prizeIndex, pointsWon, label, nextFreeSpinAt } = res.data;

      // Animate to correct slice
      const sliceAngle = 360 / WHEEL_SLICES.length;
      const targetAngle = 360 - (prizeIndex * sliceAngle + sliceAngle / 2);
      const fullSpins = 5 * 360;
      const newRotation = rotation + fullSpins + targetAngle - (rotation % 360);
      setRotation(newRotation);

      setTimeout(() => {
        setResult({ points: pointsWon, label });
        setCanFreeSpin(false);
        setNextSpinAt(nextFreeSpinAt);
        updateUser({ balance: user.balance + pointsWon });
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
        setSpinning(false);
      }, 4200);
    } catch {
      alert("Spin failed — try again");
      setSpinning(false);
    }
  };

  // Build conic gradient for wheel
  const sliceAngle = 360 / WHEEL_SLICES.length;
  const conicStops = WHEEL_SLICES.map((s, i) => {
    const start = i * sliceAngle;
    const end = start + sliceAngle;
    return `${s.color} ${start}deg ${end}deg`;
  }).join(", ");

  // Countdown
  let countdown = "";
  if (!canFreeSpin && nextSpinAt) {
    const ms = new Date(nextSpinAt).getTime() - Date.now();
    if (ms > 0) {
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      countdown = `${h}h ${m}m`;
    } else {
      setCanFreeSpin(true);
    }
  }

  if (loading) {
    return (
      <div className="spin-container">
        <div className="splash-spinner" />
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 24 }}>←</button>
        <div>
          <div className="page-title">🎰 Spin Wheel</div>
          <div className="page-subtitle">Win up to 5,000 points!</div>
        </div>
        <div />
      </div>

      <div className="spin-container">
        <div className="wheel-wrapper">
          <div className="wheel-pointer">▼</div>
          <div
            className="spin-wheel"
            style={{
              background: `conic-gradient(${conicStops})`,
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? "transform 4s cubic-bezier(0.17, 0.67, 0.12, 1)" : "none",
            }}
          >
            {WHEEL_SLICES.map((s, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: "50%",
                  transformOrigin: "0 0",
                  transform: `rotate(${i * sliceAngle + sliceAngle / 2}deg) translateY(-50%)`,
                  fontSize: "11px",
                  fontWeight: 800,
                  color: "#fff",
                  textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                  paddingLeft: 8,
                  userSelect: "none",
                }}
              >
                {s.label}
              </div>
            ))}
          </div>
          <div className="wheel-center">🪙</div>
        </div>

        {result && (
          <div className="spin-result animate-bounce-in">
            <div style={{ fontSize: 24, marginBottom: 4 }}>
              {result.points >= 5000 ? "🎉 JACKPOT!!!" : "🎊 You won!"}
            </div>
            <div className="spin-result-points">+{result.points.toLocaleString()}</div>
            <div style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 4 }}>{result.label} points added!</div>
          </div>
        )}

        <button
          className="spin-btn"
          disabled={spinning || (!canFreeSpin)}
          onClick={() => doSpin("free")}
        >
          {spinning ? "Spinning..." : canFreeSpin ? "🎰 Free Spin!" : `⏰ ${countdown}`}
        </button>

        {!canFreeSpin && (
          <button
            className="spin-btn"
            style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", boxShadow: "none", marginTop: -8 }}
            disabled={spinning}
            onClick={() => doSpin("paid")}
          >
            💸 Paid Spin (50 pts)
          </button>
        )}

        <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
          Free spin every 8 hours · Paid spin costs 50 pts
        </div>
      </div>
    </>
  );
}

/* ── Daily Check-in ──────────────────────────────────────── */
function DailyView({ user, updateUser, onBack }: { user: UserProfile; updateUser: (u: Partial<UserProfile>) => void; onBack: () => void }) {
  const [streak, setStreak] = useState(0);
  const [checkedIn, setCheckedIn] = useState(false);
  const [todayReward, setTodayReward] = useState(50);
  const [claiming, setClaiming] = useState(false);
  const [justClaimed, setJustClaimed] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCheckinStatus()
      .then((res) => {
        if (res.success) {
          setStreak(res.data.currentStreak);
          setCheckedIn(res.data.checkedInToday);
          setTodayReward(res.data.todayReward);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const claim = async () => {
    if (claiming || checkedIn) return;
    setClaiming(true);
    try {
      const res = await dailyCheckin();
      if (res.success && !res.data.alreadyCheckedIn) {
        setStreak(res.data.streak);
        setCheckedIn(true);
        setJustClaimed(res.data.pointsAwarded);
        updateUser({ balance: user.balance + res.data.pointsAwarded });
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
      } else {
        setCheckedIn(true);
      }
    } catch {
      alert("Check-in failed — try again");
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return <div className="daily-container"><div className="splash-spinner" style={{ margin: "60px auto" }} /></div>;
  }

  return (
    <>
      <div className="page-header">
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 24 }}>←</button>
        <div>
          <div className="page-title">📅 Daily Check-in</div>
          <div className="page-subtitle">Streak rewards up to 500 pts/day</div>
        </div>
        <div />
      </div>

      <div className="daily-container">
        {justClaimed && (
          <div className="card card-accent animate-bounce-in" style={{ margin: "0 0 16px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 4 }}>🎉</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "var(--gold)" }}>+{justClaimed} points!</div>
            <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>Day {streak} streak bonus!</div>
          </div>
        )}

        <div className="streak-display">
          <div className="streak-fire">{streak >= 7 ? "💎" : streak >= 3 ? "🔥" : "✨"}</div>
          <div className="streak-count">{streak}</div>
          <div className="streak-label">Day Streak</div>

          <div className="streak-dots">
            {[1,2,3,4,5,6,7].map((day) => (
              <div
                key={day}
                className={`streak-dot ${day < streak ? "done" : day === streak && checkedIn ? "done" : day === streak ? "today" : ""}`}
              >
                {day < streak || (day === streak && checkedIn) ? "✓" : STREAK_REWARDS[day] !== undefined ? `${STREAK_REWARDS[day]}` : "?"}
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ margin: "0 0 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              {checkedIn ? "✅ Checked in today!" : `Today's reward: +${todayReward} pts`}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
              {checkedIn ? "Come back tomorrow for your streak!" : "Tap to claim your daily reward"}
            </div>
          </div>
        </div>

        <button
          className="checkin-btn"
          disabled={checkedIn || claiming}
          onClick={claim}
        >
          {claiming ? "Claiming..." : checkedIn ? "✅ Already Checked In" : `🎁 Claim +${todayReward} pts`}
        </button>

        <div className="section-title" style={{ padding: "20px 0 8px" }}>Streak Rewards</div>
        {Object.entries(STREAK_REWARDS).map(([day, pts]) => (
          <div key={day} className="card" style={{ margin: "0 0 8px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%", background: Number(day) <= streak ? "var(--accent)" : "var(--bg-elevated)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 800, color: Number(day) <= streak ? "#000" : "var(--text-muted)",
              border: `2px solid ${Number(day) === streak + 1 ? "var(--gold)" : "transparent"}`,
              flexShrink: 0,
            }}>
              {Number(day) <= streak ? "✓" : day}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Day {day}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {Number(day) === 7 ? "Max streak bonus!" : `${pts} points`}
              </div>
            </div>
            <div style={{ fontWeight: 700, color: "var(--gold)", fontSize: 14 }}>+{pts}</div>
          </div>
        ))}
      </div>
    </>
  );
}
