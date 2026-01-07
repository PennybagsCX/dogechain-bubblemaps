import React, { useState, useRef } from "react";
import { ViewState } from "../types";
import { useClickOutside } from "../hooks/useClickOutside";
import { handleTouchStopPropagation } from "../utils/touchHandlers";
import {
  LayoutDashboard,
  Map,
  Search,
  Wallet as WalletIcon,
  LogOut,
  Loader2,
  Menu,
  X,
} from "lucide-react";

interface NavbarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  userAddress: string | null;
  onConnectWallet: () => void;
  onDisconnectWallet: () => void;
  isConnecting?: boolean;
  hasAnalysisData?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onChangeView,
  userAddress,
  onConnectWallet,
  onDisconnectWallet,
  isConnecting = false,
  hasAnalysisData = false,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Create ref for mobile menu click-outside detection
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Apply click-outside hook
  useClickOutside(mobileMenuRef, () => setIsMobileMenuOpen(false), isMobileMenuOpen);

  const navClass = (view: ViewState, disabled: boolean = false) =>
    `flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-purple-500 focus:outline-none ${
      currentView === view
        ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20"
        : disabled
          ? "text-slate-600 cursor-not-allowed"
          : "text-slate-400 hover:text-white hover:bg-space-700"
    }`;

  const mobileNavClass = (view: ViewState, disabled: boolean = false) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none ${
      currentView === view
        ? "bg-purple-600 text-white"
        : disabled
          ? "text-slate-600"
          : "text-slate-400 hover:text-white hover:bg-space-700"
    }`;

  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.slice(-4)}`;
  };

  const handleMobileNav = (view: ViewState) => {
    // Check if user is trying to access Dashboard without wallet connection
    if (view === ViewState.DASHBOARD && !userAddress) {
      // Prompt user to connect wallet
      onConnectWallet();
      return;
    }
    onChangeView(view);
    setIsMobileMenuOpen(false);
  };

  const handleLogoKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleMobileNav(ViewState.HOME);
    }
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 w-full border-b border-space-700 bg-space-900/95 backdrop-blur-md">
        <div className="w-full flex h-16 items-center justify-between px-4">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onTouchStart={handleTouchStopPropagation}
            onClick={() => handleMobileNav(ViewState.HOME)}
            onKeyDown={handleLogoKeyDown}
            role="button"
            tabIndex={0}
            aria-label="Go to home"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 text-white font-bold shadow-lg shadow-purple-600/20">
              Ð
            </div>
            <span className="text-xl font-bold tracking-tight text-white">
              Dogechain <span className="text-purple-500">BubbleMaps</span>
            </span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-2">
            <button
              onTouchStart={handleTouchStopPropagation}
              onClick={() => onChangeView(ViewState.HOME)}
              className={navClass(ViewState.HOME)}
            >
              <Search size={18} />
              <span>Search</span>
            </button>
            <button
              onTouchStart={handleTouchStopPropagation}
              onClick={() => onChangeView(ViewState.ANALYSIS)}
              className={navClass(ViewState.ANALYSIS)}
            >
              <Map size={18} />
              <span>Analysis</span>
              {!hasAnalysisData && currentView !== ViewState.ANALYSIS && (
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600 ml-1"></span>
              )}
            </button>
            <button
              onTouchStart={handleTouchStopPropagation}
              onClick={() => handleMobileNav(ViewState.DASHBOARD)}
              className={navClass(ViewState.DASHBOARD)}
              title={!userAddress ? "Connect wallet to access Dashboard" : undefined}
            >
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </button>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-4">
            {userAddress ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-space-800 border border-space-700 rounded-md text-sm text-white shadow-sm">
                  <WalletIcon size={14} className="text-purple-500" />
                  {formatAddress(userAddress)}
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 border-l border-space-600 pl-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                    <span>Dogechain</span>
                  </div>
                </div>
                <button
                  onTouchStart={handleTouchStopPropagation}
                  onClick={onDisconnectWallet}
                  className="p-2 text-slate-400 hover:text-red-400 hover:bg-space-800 rounded-md transition-colors"
                  title="Disconnect"
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <button
                onTouchStart={handleTouchStopPropagation}
                onClick={onConnectWallet}
                disabled={isConnecting}
                className="flex items-center gap-2 rounded-md bg-space-700 px-3 sm:px-4 py-2 text-sm font-medium text-white hover:bg-space-600 hover:text-purple-500 border border-space-600 hover:border-purple-500 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                {isConnecting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <WalletIcon size={16} />
                )}
                <span className="hidden sm:inline">
                  {isConnecting ? "Connecting..." : "Connect Wallet"}
                </span>
                <span className="sm:hidden">{isConnecting ? "..." : "Connect"}</span>
              </button>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onTouchStart={handleTouchStopPropagation}
              className="md:hidden p-3 text-slate-400 hover:text-white hover:bg-space-800 rounded-md transition-colors focus:ring-2 focus:ring-purple-500 focus:outline-none"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {isMobileMenuOpen && (
          <div
            ref={mobileMenuRef}
            className="md:hidden border-t border-space-700 bg-space-800 px-4 py-4 flex flex-col gap-2 absolute w-full shadow-2xl animate-in slide-in-from-top-5 z-50"
          >
            <button
              onTouchStart={handleTouchStopPropagation}
              onClick={() => handleMobileNav(ViewState.HOME)}
              className={mobileNavClass(ViewState.HOME)}
            >
              <Search size={20} /> Search Asset
            </button>
            <button
              onTouchStart={handleTouchStopPropagation}
              onClick={() => handleMobileNav(ViewState.ANALYSIS)}
              className={mobileNavClass(ViewState.ANALYSIS)}
            >
              <Map size={20} /> Map Analysis
            </button>
            <button
              onTouchStart={handleTouchStopPropagation}
              onClick={() => handleMobileNav(ViewState.DASHBOARD)}
              className={mobileNavClass(ViewState.DASHBOARD)}
            >
              <LayoutDashboard size={20} /> Dashboard
            </button>
            {userAddress && (
              <div className="mt-2 pt-3 border-t border-space-700">
                <div className="flex items-center justify-between px-4 py-2">
                  <div className="flex items-center gap-2 text-slate-400 font-mono text-sm">
                    <WalletIcon size={14} className="text-purple-500" />
                    {formatAddress(userAddress)}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                    <span>Dogechain</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </nav>
      {/* Spacer to prevent content from going under fixed navbar */}
      <div className="h-16"></div>
    </>
  );
};
