/**
 * BubbleVisualizationGuide Component
 *
 * A multi-step modal guide for the bubble visualization section of the Map Analysis page.
 * Covers basic features (steps 1-3) and advanced features (steps 4-6).
 * Triggers on first interaction with bubble visualization or first ANALYSIS view load.
 */

import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { X } from "lucide-react";
import { Map, Circle, Network, MousePointer2, Activity, AlertTriangle } from "lucide-react";

/**
 * Interface for BubbleVisualizationGuide props
 */
export interface BubbleVisualizationGuideProps {
  isOpen: boolean;
  currentStep: number;
  totalSteps: number;
  progress: number;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
  onSkip: () => void;
}

/**
 * Guide steps content configuration
 */
const bubbleGuideSteps = [
  {
    id: "welcome",
    title: "Welcome to Bubble Visualization",
    icon: <Map size={48} className="text-blue-500" />,
    content:
      "Explore token distribution through our interactive bubble map. Each bubble represents a wallet holder - larger bubbles hold more tokens.",
    primaryAction: "Start Exploring",
    secondaryAction: "Skip Tour",
  },
  {
    id: "understanding-bubbles",
    title: "Understanding Bubbles",
    icon: <Circle size={48} className="text-blue-500" />,
    content:
      "Bubble size = token holdings. Color coding indicates wallet type. Click any bubble to view detailed holder information in the sidebar.",
    primaryAction: "Next",
    secondaryAction: "Skip",
  },
  {
    id: "connection-lines",
    title: "Connection Lines",
    icon: <Network size={48} className="text-purple-500" />,
    content:
      "Lines between bubbles show token flow. Thicker lines = larger transactions. Hover over lines to see transfer amounts.",
    primaryAction: "Next",
    secondaryAction: "Skip",
  },
  {
    id: "interactive-controls",
    title: "Interactive Controls",
    icon: <MousePointer2 size={48} className="text-green-500" />,
    content:
      "Drag to pan the visualization. Scroll to zoom in/out. Double-click a bubble to center and zoom in on that wallet.",
    primaryAction: "Next",
    secondaryAction: "Skip",
  },
  {
    id: "smart-alerts",
    title: "Smart Whale Alerts",
    icon: <AlertTriangle size={48} className="text-amber-500" />,
    content:
      "Click any wallet bubble to open its details, then create alerts to monitor activity. Get instant notifications when whales make moves or specific wallets show new transactions.",
    primaryAction: "Next",
    secondaryAction: "Skip",
  },
  {
    id: "live-data",
    title: "Live Data Updates",
    icon: <Activity size={48} className="text-emerald-500" />,
    content:
      "Watch for the 'Live' indicator - data updates in real-time. Bubbles may shift as new transactions occur.",
    primaryAction: "Got It",
    secondaryAction: null,
  },
];

/**
 * BubbleVisualizationGuide Component
 */
export const BubbleVisualizationGuide: React.FC<BubbleVisualizationGuideProps> = ({
  isOpen,
  currentStep,
  totalSteps,
  progress,
  onNext,
  onPrevious,
  onClose,
  onSkip,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const step = bubbleGuideSteps[currentStep];

  /**
   * Focus trap implementation
   * Keeps keyboard focus within the modal when open
   */
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    // Get all focusable elements
    const focusableElements = modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    // Focus first element
    firstElement?.focus();

    // Handle Tab key for focus trap
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        // Shift+Tab: Move from first to last
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab: Move from last to first
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    modalRef.current.addEventListener("keydown", handleTab);
    return () => {
      if (modalRef.current) {
        modalRef.current.removeEventListener("keydown", handleTab);
      }
    };
  }, [isOpen]);

  /**
   * Click outside to close
   */
  const handleBackdropClick = (e: React.MouseEvent) => {
    // Only close if clicking directly on backdrop (not on modal content)
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Don't render if not open or no step data
  if (!isOpen || !step) {
    return null;
  }

  const portalRoot = document.getElementById("modal-portal-root");
  if (!portalRoot) {
    return null;
  }

  // Render modal using portal
  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 animate-in fade-in duration-200"
      onClick={handleBackdropClick}
      role="presentation"
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bubble-guide-title"
        aria-describedby="bubble-guide-content"
        className="bg-space-800 rounded-xl border border-space-700 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            onClose();
          }
        }}
      >
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-space-700">
          {/* Close button row */}
          <div className="flex justify-end mb-2">
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-space-700"
              aria-label="Close bubble visualization guide"
            >
              <X size={20} />
            </button>
          </div>

          {/* Title */}
          <h3
            id="bubble-guide-title"
            className="text-lg sm:text-xl font-bold text-white text-center"
          >
            {step.title}
          </h3>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Icon */}
          <div className="flex justify-center mb-4">{step.icon}</div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-sm text-slate-400">
              Step {currentStep + 1} of {totalSteps}
            </span>
          </div>

          {/* Progress bar */}
          <div
            role="progressbar"
            aria-valuenow={currentStep + 1}
            aria-valuemin={1}
            aria-valuemax={totalSteps}
            className="w-full bg-space-700 rounded-full h-1.5 mb-6"
          >
            <div
              className="bg-purple-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Description */}
          <p
            id="bubble-guide-content"
            className="text-slate-300 text-center leading-relaxed mb-6 whitespace-pre-line"
          >
            {step.content}
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3 justify-center">
          {/* Skip button */}
          {step.secondaryAction && (
            <button
              onClick={onSkip}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              aria-label="Skip bubble visualization guide"
            >
              {step.secondaryAction}
            </button>
          )}

          {/* Previous button (hidden on first step) */}
          {currentStep > 0 && (
            <button
              onClick={onPrevious}
              className="px-4 py-2 bg-space-700 text-slate-300 rounded-lg hover:bg-space-600 transition-colors font-medium"
              aria-label="Go to previous step"
            >
              Previous
            </button>
          )}

          {/* Next/Complete button */}
          <button
            onClick={onNext}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors font-medium shadow-lg shadow-purple-600/20 focus:ring-2 focus:ring-purple-500 focus:outline-none min-w-[140px]"
            aria-label={
              currentStep === totalSteps - 1
                ? "Complete guide and start exploring"
                : "Go to next step"
            }
          >
            {step.primaryAction}
          </button>
        </div>

        {/* Screen reader announcements */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          Showing step {currentStep + 1} of {totalSteps}: {step.title}
        </div>
      </div>
    </div>,
    portalRoot
  );
};
