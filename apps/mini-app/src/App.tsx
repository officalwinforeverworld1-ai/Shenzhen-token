/**
 * Mini App — Root Component (Premium Dark UI + TON Connect)
 */

import { useState, useEffect, useCallback } from "react";
import {
  authenticate,
  devAuth,
  setAuthToken,
  getAuthToken,
  getProfile,
  type UserProfile,
  type EnergyState,
} from "./api";
import { HomePage } from "./pages/Home";
import { TasksPage } from "./pages/Tasks";
import { FriendsPage } from "./pages/Friends";
import { LeaderboardPage } from "./pages/Leaderboard";
import { UpgradesPage } from "./pages/Upgrades";
import { GamesPage } from "./pages/Games";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { WalletBar } from "./components/WalletBar";
import { TgeCountdown } from "./components/TgeCountdown";

type Page = "home" | "tasks" | "friends" | "leaderboard" | "upgrades" | "games";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe: Record<string, unknown>;
        ready: () => void;
        expand: () => void;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        HapticFeedback?: {
          impactOccurred: (style: string) => void;
          notificationOccurred: (type: string) => void;
        };
      };
    };
  }
}

export function App() {
  const [page, setPage] = useState<Page>("home");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const tg = window.Telegram?.WebApp;
        if (tg) {
          tg.ready();
          tg.expand();
          tg.setHeaderColor("#0A0E1A");
          tg.setBackgroundColor("#0A0E1A");
        }

        const existingToken = getAuthToken();
        if (existingToken) {
          try {
            const profile = await getProfile();
            if (profile.success) {
              setUser(profile.data);
              setLoading(false);
              return;
            }
          } catch {
            // Token expired, re-authenticate
          }
        }

        const initData = tg?.initData;
        if (!initData) {
          // Dev mode — use real DB user via /api/dev-auth
          if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
            try {
              const devResult = await devAuth();
              if (devResult.success) {
                setAuthToken(devResult.data.token);
                setUser(devResult.data.user);
                setLoading(false);
                return;
              }
            } catch (devErr) {
              console.warn("Dev auth failed:", devErr);
            }
          }
          setError("Open this app from Telegram");
          setLoading(false);
          return;
        }

        const authResult = await authenticate(initData);
        if (authResult.success) {
          setAuthToken(authResult.data.token);
          setUser(authResult.data.user);
        } else {
          setError("Authentication failed");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Connection failed");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const updateUser = useCallback((updates: Partial<UserProfile>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  const updateEnergy = useCallback((energy: EnergyState) => {
    setUser((prev) => (prev ? { ...prev, energy } : null));
  }, []);

  if (loading) {
    return (
      <div className="splash-screen">
        <div className="splash-coin">🪙</div>
        <div className="splash-title">Shén Zhèn Airdrop</div>
        <div className="splash-spinner" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="splash-screen">
        <div className="splash-coin">😵</div>
        <div className="splash-title">{error ?? "Something went wrong"}</div>
        <p className="splash-sub">Open from Telegram to continue</p>
      </div>
    );
  }

  const renderPage = () => {
    switch (page) {
      case "home":
        return <HomePage user={user} updateUser={updateUser} updateEnergy={updateEnergy} onNavigate={setPage} />;
      case "tasks":
        return <TasksPage user={user} updateUser={updateUser} />;
      case "friends":
        return <FriendsPage />;
      case "leaderboard":
        return <LeaderboardPage userId={user.id} />;
      case "upgrades":
        return <UpgradesPage user={user} updateUser={updateUser} />;
      case "games":
        return <GamesPage user={user} updateUser={updateUser} />;
    }
  };

  const navItems: { id: Page; icon: string; label: string }[] = [
    { id: "home",        icon: "⚡", label: "Earn"     },
    { id: "upgrades",    icon: "🚀", label: "Boost"    },
    { id: "games",       icon: "🎰", label: "Games"    },
    { id: "friends",     icon: "👥", label: "Friends"  },
    { id: "leaderboard", icon: "🏆", label: "Rank"     },
  ];

  return (
    <div className="app-shell">
      <WalletBar user={user} updateUser={updateUser} />
      <TgeCountdown />
      <div className="app-content">{renderPage()}</div>

      <nav className="bottom-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${page === item.id ? "active" : ""}`}
            onClick={() => setPage(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
            {page === item.id && <span className="nav-indicator" />}
          </button>
        ))}
      </nav>
    </div>
  );
}

// Wrap with TON Connect provider
export function AppWithProviders() {
  const manifestUrl = `${window.location.origin}/app/tonconnect-manifest.json`;
  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <App />
    </TonConnectUIProvider>
  );
}
