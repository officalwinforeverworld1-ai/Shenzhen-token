/**
 * TGE Countdown — Shows a countdown to the Token Generation Event.
 * Date is configurable — set TGE_DATE to a future date, or null for "TBA".
 */

import { useState, useEffect } from "react";

// ─── CONFIG ───────────────────────────────────────────────
// Set to a future ISO date string when the TGE date is decided.
// Set to null to show "TBA" placeholder.
const TGE_DATE: string | null = null; // e.g. "2026-09-01T00:00:00Z"

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calcTimeLeft(target: Date): TimeLeft | null {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1_000),
  };
}

export function TgeCountdown() {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);

  useEffect(() => {
    if (!TGE_DATE) return;

    const target = new Date(TGE_DATE);
    setTimeLeft(calcTimeLeft(target));

    const interval = setInterval(() => {
      const tl = calcTimeLeft(target);
      if (!tl) {
        clearInterval(interval);
        setTimeLeft(null);
      } else {
        setTimeLeft(tl);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="tge-bar">
      <div className="tge-label">
        <span className="tge-dot" />
        $SHEN Airdrop
      </div>

      {TGE_DATE && timeLeft ? (
        <div className="tge-countdown">
          <div className="tge-unit">
            <span className="tge-num">{pad(timeLeft.days)}</span>
            <span className="tge-sub">D</span>
          </div>
          <span className="tge-sep">:</span>
          <div className="tge-unit">
            <span className="tge-num">{pad(timeLeft.hours)}</span>
            <span className="tge-sub">H</span>
          </div>
          <span className="tge-sep">:</span>
          <div className="tge-unit">
            <span className="tge-num">{pad(timeLeft.minutes)}</span>
            <span className="tge-sub">M</span>
          </div>
          <span className="tge-sep">:</span>
          <div className="tge-unit">
            <span className="tge-num">{pad(timeLeft.seconds)}</span>
            <span className="tge-sub">S</span>
          </div>
        </div>
      ) : TGE_DATE && !timeLeft ? (
        <div className="tge-live">🚀 LIVE NOW</div>
      ) : (
        <div className="tge-tba">TBA</div>
      )}
    </div>
  );
}
