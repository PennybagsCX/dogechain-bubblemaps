import React, { useState, useRef, useEffect, KeyboardEvent } from "react";
import { ChevronDown, Check } from "lucide-react";

interface Option {
  value: string;
  label: string;
  description?: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  className?: string;
  ariaDescribedBy?: string;
  disabled?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  className = "",
  ariaDescribedBy,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const focusedIndexRef = useRef<number>(-1);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        focusedIndexRef.current = -1;
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
    return undefined;
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;

    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        if (isOpen && focusedIndexRef.current >= 0 && focusedIndexRef.current < options.length) {
          const selectedOption = options[focusedIndexRef.current];
          if (selectedOption) {
            onChange(selectedOption.value);
            setIsOpen(false);
          }
        } else {
          setIsOpen(!isOpen);
        }
        focusedIndexRef.current = -1;
        break;
      case "ArrowDown":
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          focusedIndexRef.current = Math.min(focusedIndexRef.current + 1, options.length - 1);
          scrollOptionIntoView(focusedIndexRef.current);
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (isOpen) {
          focusedIndexRef.current = Math.max(focusedIndexRef.current - 1, 0);
          scrollOptionIntoView(focusedIndexRef.current);
        }
        break;
      case "Escape":
        setIsOpen(false);
        focusedIndexRef.current = -1;
        break;
    }
  };

  const scrollOptionIntoView = (index: number): void => {
    setTimeout(() => {
      const list = listRef.current;
      if (list) {
        const items = list.querySelectorAll("li");
        const focusedItem = items[index] as HTMLElement;
        if (focusedItem) {
          focusedItem.scrollIntoView({ block: "nearest" });
        }
      }
    }, 0);
  };

  return (
    <div
      ref={selectRef}
      className={`relative ${className}`}
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded={isOpen}
      aria-controls="custom-select-listbox"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`
          w-full px-4 py-2.5 bg-space-900 border rounded-lg text-left
          flex items-center justify-between gap-3 transition-all
          focus:outline-none focus:ring-2 focus:ring-purple-500/50
          ${disabled ? "opacity-50 cursor-not-allowed border-space-800" : "border-space-700 hover:border-purple-500/50 cursor-pointer"}
          ${isOpen ? "border-purple-500 ring-2 ring-purple-500/20" : ""}
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-disabled={disabled}
        aria-describedby={ariaDescribedBy}
      >
        <span className="flex-1 text-white truncate">
          {selectedOption?.label || "Select an option"}
        </span>
        <ChevronDown
          size={18}
          className={`text-slate-400 transition-transform duration-200 flex-shrink-0 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <ul
          id="custom-select-listbox"
          ref={listRef}
          role="listbox"
          className={`
            absolute z-50 w-full mt-1 bg-space-800 border border-space-700
            rounded-lg shadow-2xl max-h-60 overflow-auto
            animate-in fade-in slide-in-from-top-1 duration-200
          `}
          style={{
            // Ensure dropdown doesn't go off screen on mobile
            left: 0,
            right: 0,
          }}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;

            return (
              <li
                key={option.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                  focusedIndexRef.current = -1;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onChange(option.value);
                    setIsOpen(false);
                    focusedIndexRef.current = -1;
                  }
                }}
                onMouseEnter={() => {
                  focusedIndexRef.current = index;
                }}
                className={`
                  px-4 py-2.5 cursor-pointer transition-colors
                  flex items-center justify-between gap-3
                  ${
                    isSelected
                      ? "bg-purple-600 text-white"
                      : "text-slate-300 hover:bg-space-700 hover:text-white"
                  }
                `}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{option.label}</div>
                  {option.description && (
                    <div
                      className={`text-xs mt-0.5 truncate ${isSelected ? "text-purple-200" : "text-slate-500"}`}
                    >
                      {option.description}
                    </div>
                  )}
                </div>
                {isSelected && <Check size={18} className="flex-shrink-0" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
