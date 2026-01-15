/**
 * Custom hook for managing wallet details guide state and interactions
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  shouldShowWalletDetailsGuide,
  setWalletDetailsGuideSeen,
  setWalletDetailsGuideSkipped,
  updateWalletDetailsGuideProgress,
} from "../utils/guideStorage";

/**
 * Return type for useWalletDetailsGuide hook
 */
export interface UseWalletDetailsGuideReturn {
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
 * Total number of steps in the wallet details guide
 */
const TOTAL_STEPS = 6;

const SESSION_KEY = "dogechain_wallet_details_guide_session_shown";

const getSessionSeen = () => {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "true";
  } catch {
    return false;
  }
};

const setSessionSeen = () => {
  try {
    sessionStorage.setItem(SESSION_KEY, "true");
  } catch {
    /* ignore */
  }
};

/**
 * Custom hook for wallet details guide state management
 *
 * Handles:
 * - Auto-show logic when wallet sidebar opens
 * - Step navigation
 * - localStorage persistence
 * - Keyboard navigation (ESC, arrows)
 * - Manual open/close
 * - Focus restoration
 */
export function useWalletDetailsGuide(triggerCondition: boolean): UseWalletDetailsGuideReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasInitialized, setHasInitialized] = useState(false);

  const hasShownThisSessionRef = useRef<boolean>(getSessionSeen());

  // Track trigger element for focus restoration
  const triggerElementRef = useRef<HTMLElement | null>(null);
  const isInitializingRef = useRef(false);

  /**
   * Close wallet details guide
   */
  const closeGuide = useCallback(() => {
    // Save current step progress
    updateWalletDetailsGuideProgress(currentStep);

    setIsOpen(false);

    // Restore focus to trigger element
    if (triggerElementRef.current) {
      triggerElementRef.current.focus();
      triggerElementRef.current = null;
    }
  }, [currentStep]);

  /**
   * Complete wallet details guide
   */
  const completeGuide = useCallback(() => {
    setWalletDetailsGuideSeen();
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
   * Initialize: Check if guide should be shown on first wallet selection
   */
  useEffect(() => {
    if (hasInitialized || isInitializingRef.current) return undefined;

    const shouldShow = shouldShowWalletDetailsGuide();
    const alreadySeenSession = hasShownThisSessionRef.current;
    const alreadySeen = hasInitialized;
    const alreadyInitializing = isInitializingRef.current;

    // Trigger when condition becomes true AND guide should show AND not already shown this session
    if (
      shouldShow &&
      triggerCondition &&
      !alreadySeenSession &&
      !alreadySeen &&
      !alreadyInitializing
    ) {
      isInitializingRef.current = true;
      // Auto-show with delay for smooth UX (0.8s delay to let sidebar render)
      const timer = setTimeout(() => {
        setIsOpen(true);
        setHasInitialized(true);
        setSessionSeen();
        hasShownThisSessionRef.current = true;
        isInitializingRef.current = false;
      }, 800);

      return () => clearTimeout(timer);
    } else {
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        setHasInitialized(true);
        isInitializingRef.current = false;
      }, 0);
    }

    return undefined;
  }, [hasInitialized, triggerCondition]);

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
   * Open wallet details guide manually
   */
  const openGuide = useCallback(() => {
    // Store trigger element for focus restoration
    triggerElementRef.current = document.activeElement as HTMLElement;

    // Reset to first step when opening manually
    setCurrentStep(0);
    setIsOpen(true);
    setHasInitialized(true);
    setSessionSeen();
    hasShownThisSessionRef.current = true;
  }, []);

  /**
   * Skip wallet details guide
   */
  const skipGuide = useCallback(() => {
    setWalletDetailsGuideSkipped();
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
