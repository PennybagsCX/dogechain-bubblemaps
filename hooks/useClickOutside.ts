import { useEffect, RefObject } from "react";

/**
 * Hook to detect clicks outside a component
 * @param ref - React ref to the component element
 * @param callback - Function to call when click outside is detected
 * @param isActive - Optional flag to enable/disable detection
 */
export function useClickOutside(
  ref: RefObject<HTMLElement>,
  callback: () => void,
  isActive: boolean = true
) {
  useEffect(() => {
    if (!isActive) return;

    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    };

    document.addEventListener("mousedown", handleClick);

    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [ref, callback, isActive]);
}
