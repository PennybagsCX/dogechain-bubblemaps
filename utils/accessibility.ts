/**
 * Accessibility utilities and helpers
 * Ensures the application is usable by everyone
 */

/**
 * Generate a unique ID for ARIA attributes
 */
let idCounter = 0;
export const generateId = (prefix: string = "a11y"): string => {
  return `${prefix}-${idCounter++}`;
};

/**
 * Announce messages to screen readers
 * Uses an ARIA live region for dynamic content announcements
 */
export const announceToScreenReader = (
  message: string,
  priority: "polite" | "assertive" = "polite"
): void => {
  const announcement = document.createElement("div");
  announcement.setAttribute("role", "status");
  announcement.setAttribute("aria-live", priority);
  announcement.setAttribute("aria-atomic", "true");
  announcement.className = "sr-only";

  announcement.textContent = message;
  document.body.appendChild(announcement);

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};

/**
 * Trap focus within a container (for modals, dialogs)
 */
export const trapFocus = (container: HTMLElement): (() => void) => {
  const focusableElements = container.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );

  const firstElement = focusableElements[0] as HTMLElement;
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

  const handleTabKey = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement.focus();
        e.preventDefault();
      }
    }
  };

  container.addEventListener("keydown", handleTabKey);

  // Focus first element
  if (firstElement) {
    firstElement.focus();
  }

  // Return cleanup function
  return () => {
    container.removeEventListener("keydown", handleTabKey);
  };
};

/**
 * Create a skip link for keyboard navigation
 */
export const createSkipLink = (
  targetId: string,
  text: string = "Skip to main content"
): HTMLAnchorElement => {
  const skipLink = document.createElement("a");
  skipLink.href = `#${targetId}`;
  skipLink.textContent = text;
  skipLink.className =
    "sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-doge-600 focus:text-white focus:rounded";
  skipLink.setAttribute("data-skip-link", "true");
  return skipLink;
};

/**
 * Check if an element is visible to screen readers
 */
export const isVisible = (element: HTMLElement): boolean => {
  return !(
    element.hidden ||
    element.style.display === "none" ||
    element.style.visibility === "hidden" ||
    element.getAttribute("aria-hidden") === "true"
  );
};

/**
 * Get all focusable elements within a container
 */
export const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
  const focusableSelectors = [
    "a[href]",
    "button:not([disabled])",
    "textarea:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(", ");

  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors));
};

/**
 * Set ARIA attributes for loading states
 */
export const setLoading = (element: HTMLElement, loading: boolean): void => {
  element.setAttribute("aria-busy", loading.toString());
  if (loading) {
    element.setAttribute("aria-live", "polite");
  }
};

/**
 * Create an accessible button from any element
 */
export const makeAccessibleButton = (
  element: HTMLElement,
  label: string,
  onClick: () => void
): void => {
  element.setAttribute("role", "button");
  element.setAttribute("tabindex", "0");
  element.setAttribute("aria-label", label);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  element.addEventListener("keydown", handleKeyDown);
  element.addEventListener("click", onClick);
};

/**
 * Check color contrast for WCAG compliance
 * Returns true if contrast ratio meets AA standard (4.5:1 for normal text)
 */
export const checkColorContrast = (foreground: string, background: string): boolean => {
  const getLuminance = (hex: string): number => {
    const rgb = parseInt(hex.replace("#", ""), 16);
    const r = ((rgb >> 16) & 0xff) / 255;
    const g = ((rgb >> 8) & 0xff) / 255;
    const b = (rgb & 0xff) / 255;

    const mapped = [r, g, b].map((c) => {
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    const rL = mapped[0]!;
    const gL = mapped[1]!;
    const bL = mapped[2]!;

    return 0.2126 * rL + 0.7152 * gL + 0.0722 * bL;
  };

  const lum1 = getLuminance(foreground);
  const lum2 = getLuminance(background);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);

  const contrast = (brightest + 0.05) / (darkest + 0.05);
  return contrast >= 4.5;
};

/**
 * Add visually-hidden class for screen-reader-only text
 */
export const visuallyHiddenClass = "sr-only";

/**
 * Common ARIA labels for the application
 */
export const ARIA_LABELS = {
  CLOSE: "Close dialog or panel",
  OPEN_MENU: "Open navigation menu",
  SEARCH: "Search for tokens or NFTs",
  CONNECT_WALLET: "Connect your wallet",
  DISCONNECT_WALLET: "Disconnect your wallet",
  VIEW_ANALYSIS: "View token analysis",
  VIEW_DASHBOARD: "View alerts dashboard",
  LOAD_MORE: "Load more items",
  REFRESH: "Refresh data",
  EXPORT: "Export data",
  SHARE: "Share this analysis",
  LOADING: "Loading data, please wait",
  ERROR: "An error occurred",
  SUCCESS: "Operation successful",
} as const;

/**
 * Apply common accessibility attributes to a container
 */
export const applyAccessibilityProps = (
  element: HTMLElement,
  props: {
    role?: string;
    label?: string;
    labelledBy?: string;
    describedBy?: string;
    live?: "polite" | "assertive" | "off";
    hidden?: boolean;
  }
): void => {
  if (props.role) element.setAttribute("role", props.role);
  if (props.label) element.setAttribute("aria-label", props.label);
  if (props.labelledBy) element.setAttribute("aria-labelledby", props.labelledBy);
  if (props.describedBy) element.setAttribute("aria-describedby", props.describedBy);
  if (props.live) element.setAttribute("aria-live", props.live);
  if (props.hidden !== undefined) element.setAttribute("aria-hidden", props.hidden.toString());
};

/**
 * Keyboard shortcut hints
 */
export const KEYBOARD_SHORTCUTS = {
  ESCAPE: "Escape - Close dialogs or panels",
  ARROWS: "Arrow keys - Navigate between elements",
  ENTER: "Enter - Activate focused element",
  SPACE: "Space - Activate button or toggle",
  HOME: "Home - Jump to first item",
  END: "End - Jump to last item",
  TAB: "Tab - Move to next focusable element",
  SHIFT_TAB: "Shift + Tab - Move to previous focusable element",
} as const;
