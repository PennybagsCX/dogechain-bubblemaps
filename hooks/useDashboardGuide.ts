/**
 * Custom hook for managing Dashboard guide state and interactions
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  shouldShowDashboardGuide,
  setDashboardGuideSeen,
  setDashboardGuideSkipped,
  updateDashboardGuideProgress,
} from "../utils/dashboardGuideStorage";

/**
 * Return type for useDashboardGuide hook
 */
export interface UseDashboardGuideReturn {
  isOpen: boolean;
  currentStep: number;
  totalSteps: number;
  progress: number;
  openGuide: () => void;
  closeGuide: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipGuide: () => void;
  completeGuide: () => void;
}

/**
 * Total number of steps in the Dashboard guide
 */
const TOTAL_STEPS = 6;

/**
 * Custom hook for Dashboard guide state management
 *
 * Handles:
 * - Auto-show logic on Dashboard page load
 * - Step navigation
 * - localStorage persistence
 * - Keyboard navigation (ESC, arrows)
 * - Manual open/close
 * - Focus restoration
 */
export function useDashboardGuide(triggerCondition: boolean): UseDashboardGuideReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Track trigger element for focus restoration
  const triggerElementRef = useRef<HTMLElement | null>(null);
  const isInitializingRef = useRef(false);

  /**
   * Close Dashboard guide
   */
  const closeGuide = useCallback(() => {
    // Save current step progress
    updateDashboardGuideProgress(currentStep);

    setIsOpen(false);

    // Restore focus to trigger element
    if (triggerElementRef.current) {
      triggerElementRef.current.focus();
      triggerElementRef.current = null;
    }
  }, [currentStep]);

  /**
   * Complete Dashboard guide
   */
  const completeGuide = useCallback(() => {
    setDashboardGuideSeen();
    setIsOpen(false);

    // Restore focus to trigger element
    if (triggerElementRef.current) {
      triggerElementRef.current.focus();
      triggerElementRef.current = null;
    }
  }, []);

  /**
   * Navigate to next step
   */
  const nextStep = useCallback(() => {
    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Last step: complete guide
      completeGuide();
    }
  }, [currentStep, completeGuide]);

  /**
   * Navigate to previous step
   */
  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  /**
   * Initialize: Check if guide should be shown on Dashboard load
   */
  useEffect(() => {
    // Don't re-trigger if already shown and completed
    if (hasInitialized && !isOpen) return undefined;

    const shouldShow = shouldShowDashboardGuide();

    // Trigger when condition becomes true AND guide should show
    if (shouldShow && triggerCondition && !isInitializingRef.current) {
      isInitializingRef.current = true;
      // Auto-show with delay for smooth UX (2.5s delay for Dashboard load)
      const timer = setTimeout(() => {
        setIsOpen(true);
        setHasInitialized(true);
        isInitializingRef.current = false;
      }, 2500);

      return () => clearTimeout(timer);
    }

    // Mark as initialized even if not showing (user has entered view)
    if (triggerCondition && !hasInitialized && !isInitializingRef.current) {
      setTimeout(() => {
        setHasInitialized(true);
      }, 0);
    }

    return undefined;
  }, [triggerCondition]);

  /**
   * Keyboard navigation
   */
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC: Close modal
      if (e.key === "Escape") {
        closeGuide();
      }
      // Arrow Right: Next step
      else if (e.key === "ArrowRight") {
        e.preventDefault();
        nextStep();
      }
      // Arrow Left: Previous step
      else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevStep();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentStep, closeGuide, nextStep, prevStep]);

  /**
   * Open Dashboard guide manually
   */
  const openGuide = useCallback(() => {
    // Store trigger element for focus restoration
    triggerElementRef.current = document.activeElement as HTMLElement;

    // Reset to first step when opening manually
    setCurrentStep(0);
    setIsOpen(true);
    setHasInitialized(true);
  }, []);

  /**
   * Skip Dashboard guide
   */
  const skipGuide = useCallback(() => {
    setDashboardGuideSkipped();
    setIsOpen(false);

    // Restore focus to trigger element
    if (triggerElementRef.current) {
      triggerElementRef.current.focus();
      triggerElementRef.current = null;
    }
  }, []);

  /**
   * Calculate progress percentage
   */
  const progress = ((currentStep + 1) / TOTAL_STEPS) * 100;

  return {
    isOpen,
    currentStep,
    totalSteps: TOTAL_STEPS,
    progress,
    openGuide,
    closeGuide,
    nextStep,
    prevStep,
    skipGuide,
    completeGuide,
  };
}
