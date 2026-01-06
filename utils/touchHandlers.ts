/**
 * Prevents touch events from propagating to parent elements.
 * Use this on buttons/controls that should not trigger scrolling when touched.
 *
 * @param event - React touch event
 *
 * Example usage:
 * <button
 *   onTouchStart={handleTouchStopPropagation}
 *   onClick={handleClick}
 * >
 *   Button Content
 * </button>
 */
export function handleTouchStopPropagation(
  event: React.TouchEvent<HTMLButtonElement | HTMLDivElement | HTMLAnchorElement>
): void {
  event.stopPropagation();
}
