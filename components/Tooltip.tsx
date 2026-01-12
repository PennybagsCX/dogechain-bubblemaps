import React, { useState, useRef, useLayoutEffect } from "react";

type TooltipPosition = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  position?: TooltipPosition;
  className?: string;
  autoPosition?: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  position = "top",
  className = "",
  autoPosition = true,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState<TooltipPosition>(position);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const lastPositionRef = useRef<TooltipPosition>(position);

  // Position classes
  const positionClasses: Record<TooltipPosition, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  // Arrow position classes
  const arrowClasses: Record<TooltipPosition, string> = {
    top: "bottom-0 left-1/2 -translate-x-1/2 rotate-45 border-b border-r",
    bottom: "top-0 left-1/2 -translate-x-1/2 rotate-45 border-t border-l",
    left: "right-0 top-1/2 -translate-y-1/2 rotate-45 border-b border-r",
    right: "left-0 top-1/2 -translate-y-1/2 rotate-45 border-t border-l",
  };

  // Update position when visibility changes
  useLayoutEffect(() => {
    if (!isVisible) {
      // Reset to initial position when hiding
      return;
    }

    if (!autoPosition) {
      // Use specified position without auto-positioning
      return;
    }

    // Calculate best position after tooltip is visible
    const timer = setTimeout(() => {
      if (!containerRef.current || !tooltipRef.current) {
        return;
      }

      const container = containerRef.current;
      const tooltip = tooltipRef.current;
      const containerRect = container.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      };

      // Check each position for collision
      const positions: TooltipPosition[] = [position, "bottom", "top", "left", "right"];

      for (const pos of positions) {
        let top = 0;
        let left = 0;

        // Calculate where tooltip would be positioned
        switch (pos) {
          case "top":
            top = containerRect.top - tooltipRect.height - 8;
            left = containerRect.left + containerRect.width / 2 - tooltipRect.width / 2;
            break;
          case "bottom":
            top = containerRect.bottom + 8;
            left = containerRect.left + containerRect.width / 2 - tooltipRect.width / 2;
            break;
          case "left":
            top = containerRect.top + containerRect.height / 2 - tooltipRect.height / 2;
            left = containerRect.left - tooltipRect.width - 8;
            break;
          case "right":
            top = containerRect.top + containerRect.height / 2 - tooltipRect.height / 2;
            left = containerRect.right + 8;
            break;
        }

        // Check if tooltip fits in viewport
        const fitsTop = top >= 0;
        const fitsBottom = top + tooltipRect.height <= viewport.height;
        const fitsLeft = left >= 0;
        const fitsRight = left + tooltipRect.width <= viewport.width;

        if (fitsTop && fitsBottom && fitsLeft && fitsRight) {
          if (lastPositionRef.current !== pos) {
            lastPositionRef.current = pos;
            setActualPosition(pos);
          }
          return;
        }
      }

      // Fallback to original position if none fit
      if (lastPositionRef.current !== position) {
        lastPositionRef.current = position;
        setActualPosition(position);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [isVisible, position, autoPosition]);

  // Sync with position prop when not visible
  useLayoutEffect(() => {
    if (!isVisible && lastPositionRef.current !== position) {
      lastPositionRef.current = position;
    }
  }, [position, isVisible]);

  return (
    <div
      ref={containerRef}
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}

      {/* Tooltip Content */}
      <div
        ref={tooltipRef}
        className={`
          absolute z-50 px-3 py-1.5
          bg-space-800 border border-space-700
          rounded-lg shadow-xl
          text-xs text-slate-300
          opacity-0 transition-opacity duration-200
          pointer-events-none
          ${isVisible ? "opacity-100" : ""}
          ${positionClasses[actualPosition]}
        `}
        role="tooltip"
      >
        {typeof content === "string" ? (
          <span className="whitespace-nowrap">{content}</span>
        ) : (
          <div className="max-w-xs">{content}</div>
        )}

        {/* Arrow */}
        <div
          className={`
            absolute w-2 h-2
            bg-space-800 border border-space-700
            ${arrowClasses[actualPosition]}
          `}
        />
      </div>
    </div>
  );
};
