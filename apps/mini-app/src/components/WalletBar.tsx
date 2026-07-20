/**
 * WalletBar — TON wallet connection bar at the top of the app.
 * Uses @tonconnect/ui-react for native Telegram wallet UX.
 */

import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { useEffect, useRef } from "react";
import { connectWallet, disconnectWallet, type UserProfile } from "../api";

interface Props {
  user: UserProfile;
  updateUser: (u: Partial<UserProfile>) => void;
}

export function WalletBar({ user, updateUser }: Props) {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const syncing = useRef(false);

  // Sync wallet state with backend
  useEffect(() => {
    if (syncing.current) return;

    if (wallet && wallet.account) {
      // Wallet just connected — save to backend
      const address = wallet.account.address;
      if (address !== user.walletAddress) {
        syncing.current = true;
        connectWallet(address)
          .then((res) => {
            if (res.success) {
              updateUser({ walletAddress: address });
            }
          })
          .finally(() => {
            syncing.current = false;
          });
      }
    } else if (!wallet && user.walletAddress) {
      // Wallet disconnected
      syncing.current = true;
      disconnectWallet()
        .then(() => {
          updateUser({ walletAddress: null });
        })
        .finally(() => {
          syncing.current = false;
        });
    }
  }, [wallet]);

  const handleConnect = () => {
    tonConnectUI.openModal();
  };

  const handleDisconnect = async () => {
    await tonConnectUI.disconnect();
    await disconnectWallet();
    updateUser({ walletAddress: null });
  };

  // Format address for display: EQAb...x3Kf
  const formatAddress = (addr: string) => {
    if (addr.length <= 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const isConnected = !!wallet?.account;
  const displayAddress = wallet?.account?.address || user.walletAddress;

  return (
    <div className="wallet-bar">
      {isConnected && displayAddress ? (
        <button className="wallet-btn wallet-connected" onClick={handleDisconnect}>
          <span className="wallet-dot connected" />
          <span className="wallet-addr">{formatAddress(displayAddress)}</span>
          <span className="wallet-disconnect-hint">Disconnect</span>
        </button>
      ) : (
        <button className="wallet-btn wallet-disconnected" onClick={handleConnect}>
          <span className="wallet-dot disconnected" />
          <span className="wallet-label">Connect TON Wallet</span>
          <span className="wallet-arrow">→</span>
        </button>
      )}
    </div>
  );
}
