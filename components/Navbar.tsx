import React, { useState, useRef } from "react";
import { ViewState } from "../types";
import { useClickOutside } from "../hooks/useClickOutside";
import { handleTouchStopPropagation } from "../utils/touchHandlers";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { LayoutDashboard, Map, Search, Menu, X } from "lucide-react";

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
              onClick={() => handleMobileNav(ViewState.HOME)}
              className={navClass(ViewState.HOME)}
            >
              <Search size={18} />
              <span>Search</span>
            </button>
            <button
              onTouchStart={handleTouchStopPropagation}
              onClick={() => handleMobileNav(ViewState.ANALYSIS)}
              className={navClass(ViewState.ANALYSIS, !hasAnalysisData)}
              disabled={!hasAnalysisData}
              title={!hasAnalysisData ? "Search for an asset first" : undefined}
            >
              <Map size={18} />
              <span>Map Analysis</span>
            </button>
            <button
              onTouchStart={handleTouchStopPropagation}
              onClick={() => handleMobileNav(ViewState.DASHBOARD)}
              className={navClass(ViewState.DASHBOARD)}
            >
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </button>
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
              className={mobileNavClass(ViewState.HOME)}
            >
              <Search size={20} /> Search Asset
            </button>
            <button
              onTouchStart={handleTouchStopPropagation}
              onClick={() => handleMobileNav(ViewState.ANALYSIS)}
              className={mobileNavClass(ViewState.ANALYSIS, !hasAnalysisData)}
              disabled={!hasAnalysisData}
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
          </div>
        )}
      </nav>
      {/* Spacer to prevent content from going under fixed navbar */}
      <div className="h-16"></div>
    </>
  );
};
