import React, { useState, useRef } from "react";
import { ViewState } from "../types";
import { useClickOutside } from "../hooks/useClickOutside";
import { handleTouchStopPropagation } from "../utils/touchHandlers";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useDevWallet } from "../contexts/DevWalletContext";
import {
  LayoutDashboard,
  Map,
  Search,
  Menu,
  X,
  PieChart,
  ChevronDown,
  Bell,
  BarChart3,
  Activity,
} from "lucide-react";

interface NavbarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  hasAnalysisData?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onChangeView,
  hasAnalysisData = false,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [analysisDropdownOpen, setAnalysisDropdownOpen] = useState(false);
  const [dashboardsDropdownOpen, setDashboardsDropdownOpen] = useState(false);

  // Dev wallet state
  const devWallet = useDevWallet();

  // Create refs for click-outside detection
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const analysisDropdownRef = useRef<HTMLDivElement>(null);
  const dashboardsDropdownRef = useRef<HTMLDivElement>(null);

  // Apply click-outside hooks
  useClickOutside(mobileMenuRef, () => setIsMobileMenuOpen(false), isMobileMenuOpen);
  useClickOutside(analysisDropdownRef, () => setAnalysisDropdownOpen(false), analysisDropdownOpen);
  useClickOutside(
    dashboardsDropdownRef,
    () => setDashboardsDropdownOpen(false),
    dashboardsDropdownOpen
  );

  const navClass = (isActive: boolean, disabled: boolean = false) =>
    `flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-purple-500 focus:outline-none ${
      isActive
        ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20"
        : disabled
          ? "text-slate-600 cursor-not-allowed"
          : "text-slate-400 hover:text-white hover:bg-space-700"
    }`;

  const mobileNavClass = (isActive: boolean, disabled: boolean = false) =>
    `flex items-center justify-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none ${
      isActive
        ? "bg-purple-600 text-white"
        : disabled
          ? "text-slate-600"
          : "text-slate-400 hover:text-white hover:bg-space-700"
    }`;

  const handleMobileNav = (view: ViewState) => {
    onChangeView(view);
    setIsMobileMenuOpen(false);
  };

  const handleLogoKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleMobileNav(ViewState.HOME);
    }
  };

  const isAnalysisActive =
    currentView === ViewState.ANALYSIS ||
    currentView === ViewState.DISTRIBUTION ||
    currentView === ViewState.WALLET_ACTIVITY;
  const isDashboardsActive =
    currentView === ViewState.UNIFIED_ANALYTICS || currentView === ViewState.DASHBOARD;

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-[55] w-full border-b border-space-700 bg-space-900/95 backdrop-blur-md">
        <div className="w-full flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {/* Mobile: hamburger menu button replaces logo circle */}
            <button
              onTouchStart={handleTouchStopPropagation}
              className="md:hidden p-2 text-slate-400 hover:text-white hover:bg-space-800 rounded-md transition-colors focus:ring-2 focus:ring-purple-500 focus:outline-none"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {/* Logo: always visible, clicking goes home */}
            <div
              className="flex items-center gap-2 cursor-pointer"
              onTouchStart={handleTouchStopPropagation}
              onClick={() => handleMobileNav(ViewState.HOME)}
              onKeyDown={handleLogoKeyDown}
              role="button"
              tabIndex={0}
              aria-label="Go to home"
            >
              <div className="hidden md:flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 text-white font-bold shadow-lg shadow-purple-600/20">
                Ð
              </div>
              <span className="text-lg md:text-xl font-bold tracking-tight text-white whitespace-nowrap">
                Dogechain <span className="text-purple-500">BubbleMaps</span>
              </span>
            </div>
          </div>

          {/* Desktop Menu - Responsive layout */}
          <div className="hidden md:flex items-center gap-2">
            <button
              onTouchStart={handleTouchStopPropagation}
              onClick={() => handleMobileNav(ViewState.HOME)}
              className={navClass(currentView === ViewState.HOME)}
            >
              <Search size={18} />
              <span>Search</span>
            </button>

            {/* Analysis Dropdown */}
            <div className="relative" ref={analysisDropdownRef}>
              <button
                onTouchStart={handleTouchStopPropagation}
                onClick={() => setAnalysisDropdownOpen(!analysisDropdownOpen)}
                className={navClass(isAnalysisActive, !hasAnalysisData)}
                disabled={!hasAnalysisData}
                title={!hasAnalysisData ? "Search for an asset first" : undefined}
              >
                <Map size={18} />
                <span>Analysis</span>
                <ChevronDown size={14} />
              </button>

              <div
                className={`absolute top-full left-0 mt-2 bg-space-800 border border-space-700 rounded-lg shadow-xl py-2 min-w-[200px] transition-all duration-200 origin-top ${
                  analysisDropdownOpen && hasAnalysisData
                    ? "opacity-100 scale-y-100 pointer-events-auto"
                    : "opacity-0 scale-y-95 pointer-events-none"
                }`}
              >
                <button
                  onTouchStart={handleTouchStopPropagation}
                  onClick={() => {
                    onChangeView(ViewState.ANALYSIS);
                    setAnalysisDropdownOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                    currentView === ViewState.ANALYSIS
                      ? "bg-purple-600 text-white"
                      : "text-slate-300 hover:bg-space-700 hover:text-white"
                  }`}
                >
                  <Map size={16} />
                  <span>Bubble Map</span>
                </button>
                <button
                  onTouchStart={handleTouchStopPropagation}
                  onClick={() => {
                    onChangeView(ViewState.DISTRIBUTION);
                    setAnalysisDropdownOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                    currentView === ViewState.DISTRIBUTION
                      ? "bg-purple-600 text-white"
                      : "text-slate-300 hover:bg-space-700 hover:text-white"
                  }`}
                >
                  <PieChart size={16} />
                  <span>Distribution</span>
                </button>
                <button
                  onTouchStart={handleTouchStopPropagation}
                  onClick={() => {
                    onChangeView(ViewState.WALLET_ACTIVITY);
                    setAnalysisDropdownOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                    currentView === ViewState.WALLET_ACTIVITY
                      ? "bg-purple-600 text-white"
                      : "text-slate-300 hover:bg-space-700 hover:text-white"
                  }`}
                >
                  <Activity size={16} />
                  <span>Wallet Activity</span>
                </button>
              </div>
            </div>

            {/* Dashboards Dropdown */}
            <div className="relative" ref={dashboardsDropdownRef}>
              <button
                onTouchStart={handleTouchStopPropagation}
                onClick={() => setDashboardsDropdownOpen(!dashboardsDropdownOpen)}
                className={navClass(isDashboardsActive)}
              >
                <LayoutDashboard size={18} />
                <span>Dashboards</span>
                <ChevronDown size={14} />
              </button>

              <div
                className={`absolute top-full left-0 mt-2 bg-space-800 border border-space-700 rounded-lg shadow-xl py-2 min-w-[200px] transition-all duration-200 origin-top ${
                  dashboardsDropdownOpen
                    ? "opacity-100 scale-y-100 pointer-events-auto"
                    : "opacity-0 scale-y-95 pointer-events-none"
                }`}
              >
                <button
                  onTouchStart={handleTouchStopPropagation}
                  onClick={() => {
                    onChangeView(ViewState.DASHBOARD);
                    setDashboardsDropdownOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                    currentView === ViewState.DASHBOARD
                      ? "bg-purple-600 text-white"
                      : "text-slate-300 hover:bg-space-700 hover:text-white"
                  }`}
                >
                  <Bell size={16} />
                  <span>Alerts</span>
                </button>
                <button
                  onTouchStart={handleTouchStopPropagation}
                  onClick={() => {
                    onChangeView(ViewState.UNIFIED_ANALYTICS);
                    setDashboardsDropdownOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                    currentView === ViewState.UNIFIED_ANALYTICS
                      ? "bg-purple-600 text-white"
                      : "text-slate-300 hover:bg-space-700 hover:text-white"
                  }`}
                >
                  <BarChart3 size={16} />
                  <span>Unified Analytics</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-3">
            {/* RainbowKit Connect Button - Custom styled to match original design */}
            <ConnectButton.Custom>
              {({
                account,
                chain,
                openAccountModal,
                openChainModal,
                openConnectModal,
                authenticationStatus,
                mounted,
              }) => {
                // Check if all data is ready
                const ready = mounted && authenticationStatus !== "loading";
                const connected =
                  ready &&
                  account &&
                  chain &&
                  (!authenticationStatus || authenticationStatus === "authenticated");

                // Dev wallet: show simulated address when real wallet not connected
                const devConnected = !connected && devWallet.isActive;

                return (
                  <div
                    {...(!ready &&
                      !devConnected && {
                        "aria-hidden": true,
                        style: {
                          opacity: 0,
                          pointerEvents: "none",
                          userSelect: "none",
                        },
                      })}
                  >
                    {(() => {
                      if (devConnected) {
                        return (
                          <button
                            onClick={() => devWallet.disconnect()}
                            onTouchStart={handleTouchStopPropagation}
                            className="flex items-center gap-1 px-1.5 py-0.5 md:px-3 md:py-1.5 rounded-md transition-all duration-200 bg-amber-600 text-white shadow-lg shadow-amber-600/20 hover:bg-amber-700 focus:ring-2 focus:ring-amber-500 focus:outline-none text-[10px] md:text-sm font-medium"
                            type="button"
                            title="Dev simulated wallet - click to disconnect"
                          >
                            <span className="max-w-[56px] md:max-w-[120px] truncate">
                              <span className="md:hidden">0x...BD38</span>
                              <span className="hidden md:inline">0x742d...BD38</span>
                            </span>
                            <span className="text-[7px] md:text-[9px] bg-amber-500/30 px-0.5 md:px-1 py-px rounded text-amber-200 leading-none">
                              DEV
                            </span>
                          </button>
                        );
                      }

                      if (!connected) {
                        // In dev mode, show dev wallet as primary option with real wallet as secondary
                        if (devWallet.isDevMode) {
                          return (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => devWallet.connect()}
                                onTouchStart={handleTouchStopPropagation}
                                className="flex items-center gap-1.5 px-2 py-1 md:px-3 md:py-1.5 rounded-lg transition-all duration-200 bg-amber-600 text-white shadow-lg shadow-amber-600/20 hover:bg-amber-700 focus:ring-2 focus:ring-amber-500 focus:outline-none text-xs md:text-sm font-medium whitespace-nowrap"
                                type="button"
                                title="Connect simulated dev wallet"
                              >
                                <span className="md:hidden">Dev</span>
                                <span className="hidden md:inline">Dev Wallet</span>
                              </button>
                              <button
                                onClick={openConnectModal}
                                onTouchStart={handleTouchStopPropagation}
                                className="flex items-center gap-1.5 px-1.5 py-1 md:px-2.5 md:py-1.5 rounded-lg transition-all duration-200 bg-space-700 text-slate-400 hover:text-white hover:bg-space-600 focus:ring-2 focus:ring-purple-500 focus:outline-none text-[10px] md:text-xs font-medium whitespace-nowrap border border-space-600"
                                type="button"
                                title="Connect with a real wallet"
                              >
                                <span className="md:hidden">Wallet</span>
                                <span className="hidden md:inline">Real Wallet</span>
                              </button>
                            </div>
                          );
                        }
                        return (
                          <button
                            onClick={openConnectModal}
                            onTouchStart={handleTouchStopPropagation}
                            className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-lg transition-all duration-200 bg-purple-600 text-white shadow-lg shadow-purple-600/20 hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:outline-none text-sm md:text-base font-medium whitespace-nowrap"
                            type="button"
                          >
                            <span className="hidden sm:inline">Connect Wallet</span>
                            <span className="sm:hidden">Connect</span>
                          </button>
                        );
                      }

                      if (chain.unsupported) {
                        return (
                          <button
                            onClick={openChainModal}
                            onTouchStart={handleTouchStopPropagation}
                            className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-lg transition-all duration-200 bg-red-600 text-white shadow-lg hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:outline-none text-sm md:text-base font-medium whitespace-nowrap"
                            type="button"
                          >
                            <span className="hidden sm:inline">Wrong network</span>
                            <span className="sm:hidden">Wrong net</span>
                          </button>
                        );
                      }

                      return (
                        <button
                          onClick={openAccountModal}
                          onTouchStart={handleTouchStopPropagation}
                          className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-lg transition-all duration-200 bg-purple-600 text-white shadow-lg shadow-purple-600/20 hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:outline-none text-sm md:text-base font-medium"
                          type="button"
                        >
                          <span className="max-w-[120px] md:max-w-[200px] truncate">
                            {account.displayName}
                          </span>
                        </button>
                      );
                    })()}
                  </div>
                );
              }}
            </ConnectButton.Custom>

            {/* Mobile Menu Toggle moved to logo area */}
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        <div
          ref={mobileMenuRef}
          className={`md:hidden border-t border-space-700 bg-space-800 px-4 flex flex-col gap-2 absolute w-full shadow-2xl z-[60] transition-all duration-300 origin-top ${
            isMobileMenuOpen
              ? "opacity-100 scale-y-100 py-4 pointer-events-auto"
              : "opacity-0 scale-y-95 py-0 max-h-0 overflow-hidden pointer-events-none"
          }`}
        >
          <button
            onTouchStart={handleTouchStopPropagation}
            onClick={() => handleMobileNav(ViewState.HOME)}
            className={mobileNavClass(currentView === ViewState.HOME)}
          >
            <Search size={20} /> Search Asset
          </button>

          {/* Analysis Section */}
          <div className="flex flex-col gap-1">
            <div className="px-4 py-2 text-slate-500 text-xs uppercase tracking-wider font-semibold text-center">
              Analysis
            </div>
            <button
              onTouchStart={handleTouchStopPropagation}
              onClick={() => handleMobileNav(ViewState.ANALYSIS)}
              className={mobileNavClass(currentView === ViewState.ANALYSIS, !hasAnalysisData)}
              disabled={!hasAnalysisData}
            >
              <Map size={20} /> Bubble Map
            </button>
            <button
              onTouchStart={handleTouchStopPropagation}
              onClick={() => handleMobileNav(ViewState.DISTRIBUTION)}
              className={mobileNavClass(currentView === ViewState.DISTRIBUTION, !hasAnalysisData)}
              disabled={!hasAnalysisData}
            >
              <PieChart size={20} /> Distribution
            </button>
            <button
              onTouchStart={handleTouchStopPropagation}
              onClick={() => handleMobileNav(ViewState.WALLET_ACTIVITY)}
              className={mobileNavClass(
                currentView === ViewState.WALLET_ACTIVITY,
                !hasAnalysisData
              )}
              disabled={!hasAnalysisData}
            >
              <Activity size={20} /> Wallet Activity
            </button>
          </div>

          {/* Dashboards Section */}
          <div className="flex flex-col gap-1">
            <div className="px-4 py-2 text-slate-500 text-xs uppercase tracking-wider font-semibold text-center">
              Dashboards
            </div>
            <button
              onTouchStart={handleTouchStopPropagation}
              onClick={() => handleMobileNav(ViewState.DASHBOARD)}
              className={mobileNavClass(currentView === ViewState.DASHBOARD)}
            >
              <Bell size={20} /> Alerts
            </button>
            <button
              onTouchStart={handleTouchStopPropagation}
              onClick={() => handleMobileNav(ViewState.UNIFIED_ANALYTICS)}
              className={mobileNavClass(currentView === ViewState.UNIFIED_ANALYTICS)}
            >
              <BarChart3 size={20} /> Unified Analytics
            </button>
          </div>
        </div>
      </nav>
      {/* Spacer to prevent content from going under fixed navbar */}
      <div className="h-16"></div>
    </>
  );
};
