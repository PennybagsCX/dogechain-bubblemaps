import { useEffect, RefObject } from "react";

/**
 * Hook to detect clicks outside a component
 * Works on both desktop (mouse) and mobile (touch) devices
 * @param ref - React ref to the component element
 * @param callback - Function to call when click outside is detected
 * @param isActive - Optional flag to enable/disable detection
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  callback: () => void,
  isActive: boolean = true
) {
  useEffect(() => {
    if (!isActive) return;

    const handleClick = (event: Event) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    };

    // Use click event which works reliably on both desktop and mobile
    document.addEventListener("click", handleClick, true); // Use capture phase

    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, [ref, callback, isActive]);
}
