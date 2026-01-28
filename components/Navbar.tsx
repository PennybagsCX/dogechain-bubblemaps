import React, { useState, useRef } from "react";
import { ViewState } from "../types";
import { useClickOutside } from "../hooks/useClickOutside";
import { handleTouchStopPropagation } from "../utils/touchHandlers";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  LayoutDashboard,
  Map,
  Search,
  Menu,
  X,
  Activity,
  Building2,
  PieChart,
  ChevronDown,
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
    `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none ${
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
    currentView === ViewState.ANALYSIS || currentView === ViewState.DISTRIBUTION;
  const isDashboardsActive =
    currentView === ViewState.NETWORK_HEALTH || currentView === ViewState.DEX_ANALYTICS;

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

              {analysisDropdownOpen && hasAnalysisData && (
                <div className="absolute top-full left-0 mt-2 bg-space-800 border border-space-700 rounded-lg shadow-xl py-2 min-w-[200px]">
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
                </div>
              )}
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

              {dashboardsDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 bg-space-800 border border-space-700 rounded-lg shadow-xl py-2 min-w-[200px]">
                  <button
                    onTouchStart={handleTouchStopPropagation}
                    onClick={() => {
                      onChangeView(ViewState.NETWORK_HEALTH);
                      setDashboardsDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                      currentView === ViewState.NETWORK_HEALTH
                        ? "bg-purple-600 text-white"
                        : "text-slate-300 hover:bg-space-700 hover:text-white"
                    }`}
                  >
                    <Activity size={16} />
                    <span>Network Health</span>
                  </button>
                  <button
                    onTouchStart={handleTouchStopPropagation}
                    onClick={() => {
                      onChangeView(ViewState.DEX_ANALYTICS);
                      setDashboardsDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                      currentView === ViewState.DEX_ANALYTICS
                        ? "bg-purple-600 text-white"
                        : "text-slate-300 hover:bg-space-700 hover:text-white"
                    }`}
                  >
                    <Building2 size={16} />
                    <span>DEX Analytics</span>
                  </button>
                </div>
              )}
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

                return (
                  <div
                    {...(!ready && {
                      "aria-hidden": true,
                      style: {
                        opacity: 0,
                        pointerEvents: "none",
                        userSelect: "none",
                      },
                    })}
                  >
                    {(() => {
                      if (!connected) {
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
              className={mobileNavClass(currentView === ViewState.HOME)}
            >
              <Search size={20} /> Search Asset
            </button>

            {/* Analysis Section */}
            <div className="flex flex-col gap-1">
              <div className="px-4 py-2 text-slate-500 text-xs uppercase tracking-wider font-semibold">
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
            </div>

            {/* Dashboards Section */}
            <div className="flex flex-col gap-1">
              <div className="px-4 py-2 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                Dashboards
              </div>
              <button
                onTouchStart={handleTouchStopPropagation}
                onClick={() => handleMobileNav(ViewState.NETWORK_HEALTH)}
                className={mobileNavClass(currentView === ViewState.NETWORK_HEALTH)}
              >
                <Activity size={20} /> Network Health
              </button>
              <button
                onTouchStart={handleTouchStopPropagation}
                onClick={() => handleMobileNav(ViewState.DEX_ANALYTICS)}
                className={mobileNavClass(currentView === ViewState.DEX_ANALYTICS)}
              >
                <Building2 size={20} /> DEX Analytics
              </button>
            </div>
          </div>
        )}
      </nav>
      {/* Spacer to prevent content from going under fixed navbar */}
      <div className="h-16"></div>
    </>
  );
};
