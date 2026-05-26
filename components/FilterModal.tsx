/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/no-noninteractive-element-interactions */
import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { FilterControls } from "./FilterControls";

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Standalone filter modal rendered via portal to document.body.
 * Completely isolated from BubbleMap's D3 event system.
 * When closed, renders nothing (zero DOM footprint).
 */
export const FilterModal: React.FC<FilterModalProps> = ({ isOpen, onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
    return undefined;
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent | React.TouchEvent) => {
    // Only close if clicking the backdrop itself, not the panel
    if (e.target === e.currentTarget) {
      e.stopPropagation();
      onClose();
    }
  };

  const handleBackdropTouchStart = (e: React.TouchEvent) => {
    if (e.target === e.currentTarget) {
      e.stopPropagation();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
      onTouchStart={handleBackdropTouchStart}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Filter settings"
        className="bg-space-800 rounded-xl border border-space-700 shadow-2xl w-[92vw] max-w-sm md:w-80 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        style={{ maxHeight: "calc(100dvh - 4rem)", minHeight: 0 }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-space-800 border-b border-space-700 px-4 py-3 flex justify-between items-center">
          <h4 className="text-sm font-bold text-white">Filters</h4>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1"
            aria-label="Close filters"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <FilterControls onClose={onClose} />
        </div>
      </div>
    </div>,
    document.body
  );
};
