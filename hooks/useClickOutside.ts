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

    const handleClick = (event: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    };

    // Listen for both mouse (desktop) and touch (mobile) events
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
    };
  }, [ref, callback, isActive]);
}
