/**
 * Custom hook for managing onboarding modal state and interactions
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { onboardingContent } from "../components/OnboardingContent";
import {
  shouldShowOnboarding,
  setOnboardingSeen,
  setOnboardingSkipped,
  updateOnboardingProgress,
} from "../utils/onboardingStorage";

/**
 * Return type for useOnboarding hook
 */
export interface UseOnboardingReturn {
  isOpen: boolean;
  currentStep: number;
  totalSteps: number;
  progress: number;
  openOnboarding: () => void;
  closeOnboarding: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  skipOnboarding: () => void;
  completeOnboarding: () => void;
}

/**
 * Custom hook for onboarding state management
 *
 * Handles:
 * - Auto-show logic when entering HOME view (shows every time unless completed)
 * - Step navigation
 * - localStorage persistence
 * - Keyboard navigation (ESC, arrows)
 * - Manual open/close
 * - Focus restoration
 *
 * @param triggerCondition - When true, triggers onboarding to show (e.g., when entering HOME view)
 */
export function useOnboarding(triggerCondition?: boolean): UseOnboardingReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasInitialized, setHasInitialized] = useState(false);
  const totalSteps = onboardingContent.totalSteps;

  // Track trigger element for focus restoration
  const triggerElementRef = useRef<HTMLElement | null>(null);
  const isInitializingRef = useRef(false);

  /**
   * Close onboarding modal
   */
  const closeOnboarding = useCallback(() => {
    // Save current step progress
    updateOnboardingProgress(currentStep);

    setIsOpen(false);

    // Restore focus to trigger element
    if (triggerElementRef.current) {
      triggerElementRef.current.focus();
      triggerElementRef.current = null;
    }
  }, [currentStep]);

  /**
   * Complete onboarding
   */
  const completeOnboarding = useCallback(() => {
    setOnboardingSeen();
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
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Last step: complete onboarding
      completeOnboarding();
    }
  }, [currentStep, totalSteps, completeOnboarding]);

  /**
   * Navigate to previous step
   */
  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  /**
   * Initialize: Check if onboarding should be shown
   * Auto-triggers when entering HOME view (every time unless explicitly completed)
   */
  useEffect(() => {
    // Don't re-trigger if already shown and completed this session
    if (hasInitialized && !isOpen) return undefined;

    const shouldShow = shouldShowOnboarding();
    // Trigger when condition becomes true AND onboarding should show
    if (shouldShow && triggerCondition && !isInitializingRef.current) {
      isInitializingRef.current = true;
      // Auto-show with delay for smooth UX (1.5s delay for onboarding)
      const timer = setTimeout(() => {
        setIsOpen(true);
        setHasInitialized(true);
        isInitializingRef.current = false;
      }, 1500);

      return () => {
        clearTimeout(timer);
        // In StrictMode, effects run twice; ensure flag is cleared if timer never fires
        isInitializingRef.current = false;
      };
    }

    // Mark as initialized even if not showing (user has entered view)
    if (triggerCondition && !hasInitialized && !isInitializingRef.current) {
      isInitializingRef.current = true;
      setTimeout(() => {
        setHasInitialized(true);
        isInitializingRef.current = false;
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
        closeOnboarding();
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
  }, [isOpen, currentStep, closeOnboarding, nextStep, prevStep]);

  /**
   * Open onboarding modal manually
   */
  const openOnboarding = useCallback(() => {
    // Store trigger element for focus restoration
    triggerElementRef.current = document.activeElement as HTMLElement;

    // Reset to first step when opening manually
    setCurrentStep(0);
    setIsOpen(true);
    setHasInitialized(true);
  }, []);

  /**
   * Jump to specific step
   */
  const goToStep = useCallback(
    (step: number) => {
      if (step >= 0 && step < totalSteps) {
        setCurrentStep(step);
      }
    },
    [totalSteps]
  );

  /**
   * Skip onboarding
   */
  const skipOnboarding = useCallback(() => {
    setOnboardingSkipped();
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
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return {
    isOpen,
    currentStep,
    totalSteps,
    progress,
    openOnboarding,
    closeOnboarding,
    nextStep,
    prevStep,
    goToStep,
    skipOnboarding,
    completeOnboarding,
  };
}
