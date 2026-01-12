import React, { useState } from "react";

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  position = "top",
  className = "",
}) => {
  const [isVisible, setIsVisible] = useState(false);

  // Position classes
  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  // Arrow position classes
  const arrowClasses = {
    top: "bottom-0 left-1/2 -translate-x-1/2 rotate-45 border-b border-r",
    bottom: "top-0 left-1/2 -translate-x-1/2 rotate-45 border-t border-l",
    left: "right-0 top-1/2 -translate-y-1/2 rotate-45 border-b border-r",
    right: "left-0 top-1/2 -translate-y-1/2 rotate-45 border-t border-l",
  };

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}

      {/* Tooltip Content */}
      <div
        className={`
          absolute z-50 px-3 py-1.5
          bg-space-800 border border-space-700
          rounded-lg shadow-xl
          text-xs text-slate-300 whitespace-nowrap
          opacity-0 transition-opacity duration-200
          pointer-events-none
          ${isVisible ? "opacity-100" : ""}
          ${positionClasses[position]}
        `}
        role="tooltip"
        aria-label={content}
      >
        {content}

        {/* Arrow */}
        <div
          className={`
            absolute w-2 h-2
            bg-space-800 border border-space-700
            ${arrowClasses[position]}
          `}
        />
      </div>
    </div>
  );
};
