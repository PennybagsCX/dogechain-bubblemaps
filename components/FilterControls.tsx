import React, { useState, useRef } from "react";
import { X, Save, FolderOpen, Trash2, ChevronDown, ChevronUp, Sliders, Tag } from "lucide-react";
import {
  useFilters,
  HoldingSizeFilter,
  LabelFilter,
  ActivityFilter,
} from "../contexts/FilterContext";
import { Tooltip } from "./Tooltip";
import { useClickOutside } from "../hooks/useClickOutside";

interface FilterControlsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FilterControls: React.FC<FilterControlsProps> = ({ isOpen, onClose }) => {
  const { filters, presets, updateFilters, resetFilters, savePreset, deletePreset, applyPreset } =
    useFilters();
  const [showPresets, setShowPresets] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const presetRef = useRef<HTMLDivElement>(null);

  useClickOutside(presetRef, () => setShowPresets(false), showPresets);

  if (!isOpen) return null;

  const handleSavePreset = () => {
    if (newPresetName.trim()) {
      savePreset(newPresetName.trim());
      setNewPresetName("");
    }
  };

  const holdingSizeOptions: { value: HoldingSizeFilter; label: string; description: string }[] = [
    { value: "all", label: "All Holdings", description: "Show all wallets" },
    { value: "micro", label: "Micro (< 0.1%)", description: "Small retail holders" },
    { value: "retail", label: "Retail (0.1-1%)", description: "Regular holders" },
    { value: "whale", label: "Whale (1-5%)", description: "Large holders" },
    { value: "mega", label: "Mega (> 5%)", description: "Very large holders" },
  ];

  const labelFilterOptions: { value: LabelFilter; label: string; description: string }[] = [
    { value: "all", label: "All Wallets", description: "Show all wallets" },
    { value: "labeled", label: "Known Only", description: "Only identified entities" },
    { value: "unlabeled", label: "Unknown Only", description: "Only unidentified wallets" },
    { value: "contracts", label: "Contracts Only", description: "Only smart contracts" },
  ];

  const activityFilterOptions: { value: ActivityFilter; label: string; description: string }[] = [
    { value: "all", label: "All Activity", description: "Show all wallets" },
    { value: "inactive", label: "Inactive", description: "Few or no connections" },
    { value: "low", label: "Low Activity", description: "1-5 connections" },
    { value: "medium", label: "Medium Activity", description: "5-15 connections" },
    { value: "high", label: "High Activity", description: "15+ connections" },
  ];

  return (
    <div
      className="absolute top-12 left-0 z-30 bg-space-800 rounded-xl border border-space-700 shadow-2xl w-80 max-w-[calc(100vw-2rem)] overflow-hidden flex flex-col animate-in fade-in slide-in-from-left-2"
      style={{ maxHeight: "calc(100vh - 180px)", minHeight: 0 }}
    >
      {/* Header */}
      <div className="flex-shrink-0 bg-space-800 border-b border-space-700 px-4 py-3 flex justify-between items-center">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          <Sliders size={16} /> Advanced Filters
        </h4>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors"
          aria-label="Close filters"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4">
        {/* Basic Filters */}
        <div className="space-y-3">
          <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Basic</h5>

          {/* Show Links */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-200">Links</span>
            <button
              onClick={() => updateFilters({ showLinks: !filters.showLinks })}
              className={`w-10 h-5 rounded-full relative transition-colors ${
                filters.showLinks ? "bg-purple-600" : "bg-space-600"
              }`}
            >
              <span
                className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${
                  filters.showLinks ? "left-6" : "left-1"
                }`}
              />
            </button>
          </div>

          {/* Show Labels */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-200">Labels</span>
            <button
              onClick={() => updateFilters({ showLabels: !filters.showLabels })}
              className={`w-10 h-5 rounded-full relative transition-colors ${
                filters.showLabels ? "bg-purple-600" : "bg-space-600"
              }`}
            >
              <span
                className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${
                  filters.showLabels ? "left-6" : "left-1"
                }`}
              />
            </button>
          </div>

          {/* Min Balance Slider */}
          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Filter Dust</span>
              <span>{filters.minBalancePercent}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              step="1"
              value={filters.minBalancePercent}
              onChange={(e) => updateFilters({ minBalancePercent: parseInt(e.target.value) })}
              className="w-full h-1 bg-space-600 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              onClick={() => updateFilters({ hideDust: !filters.hideDust })}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                filters.hideDust
                  ? "bg-purple-600 text-white"
                  : "bg-space-700 text-slate-300 hover:bg-space-600"
              }`}
            >
              Hide Dust
            </button>
            <button
              onClick={() => updateFilters({ hideContracts: !filters.hideContracts })}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                filters.hideContracts
                  ? "bg-purple-600 text-white"
                  : "bg-space-700 text-slate-300 hover:bg-space-600"
              }`}
            >
              No Contracts
            </button>
            <button
              onClick={() => updateFilters({ onlyWhales: !filters.onlyWhales })}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                filters.onlyWhales
                  ? "bg-purple-600 text-white"
                  : "bg-space-700 text-slate-300 hover:bg-space-600"
              }`}
            >
              Whales Only
            </button>
          </div>
        </div>

        {/* Advanced Filters Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-300 transition-colors"
        >
          <span>Advanced Filters</span>
          {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showAdvanced && (
          <div className="space-y-4 animate-in slide-in-from-top-2">
            {/* Holding Size Filter */}
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Holding Size
              </span>
              <div className="space-y-1">
                {holdingSizeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => updateFilters({ holdingSize: option.value })}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      filters.holdingSize === option.value
                        ? "bg-purple-600 text-white"
                        : "bg-space-700 text-slate-300 hover:bg-space-600"
                    }`}
                  >
                    <div className="font-medium">{option.label}</div>
                    <div className="text-xs opacity-70">{option.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Label Filter */}
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Labels
              </span>
              <div className="space-y-1">
                {labelFilterOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => updateFilters({ label: option.value })}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      filters.label === option.value
                        ? "bg-purple-600 text-white"
                        : "bg-space-700 text-slate-300 hover:bg-space-600"
                    }`}
                  >
                    <div className="font-medium">{option.label}</div>
                    <div className="text-xs opacity-70">{option.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Activity Filter */}
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Activity Level
              </span>
              <div className="space-y-1">
                {activityFilterOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => updateFilters({ activity: option.value })}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      filters.activity === option.value
                        ? "bg-purple-600 text-white"
                        : "bg-space-700 text-slate-300 hover:bg-space-600"
                    }`}
                  >
                    <div className="font-medium">{option.label}</div>
                    <div className="text-xs opacity-70">{option.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Tags */}
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2 flex items-center gap-1">
                <Tag size={12} /> Custom Tags
              </span>
              <div className="text-xs text-slate-500 mb-2">
                Tag wallets from the sidebar to filter by custom tags
              </div>
              {filters.customTags.length === 0 ? (
                <div className="text-xs text-slate-500 italic">No tags applied yet</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {filters.customTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-purple-600/20 border border-purple-500/30 rounded text-xs text-purple-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Filter Presets */}
        <div className="space-y-2 pt-2 border-t border-space-700">
          <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Filter Presets
          </h5>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Preset name..."
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              className="flex-1 px-3 py-2 bg-space-700 border border-space-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              onKeyPress={(e) => e.key === "Enter" && handleSavePreset()}
            />
            <Tooltip content="Save current filters as preset">
              <button
                onClick={handleSavePreset}
                disabled={!newPresetName.trim()}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-space-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                <Save size={16} />
              </button>
            </Tooltip>
          </div>

          {/* Presets Dropdown */}
          <div className="relative" ref={presetRef}>
            <button
              onClick={() => setShowPresets(!showPresets)}
              className="w-full flex items-center justify-between px-3 py-2 bg-space-700 hover:bg-space-600 border border-space-600 rounded-lg text-sm text-slate-200 transition-colors"
            >
              <span className="flex items-center gap-2">
                <FolderOpen size={14} />
                {presets.length > 0 ? `${presets.length} Saved` : "No presets saved"}
              </span>
              {showPresets ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showPresets && presets.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-space-800 border border-space-700 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-center justify-between px-3 py-2 hover:bg-space-700 transition-colors"
                  >
                    <button
                      onClick={() => {
                        applyPreset(preset);
                        setShowPresets(false);
                      }}
                      className="flex-1 text-left text-sm text-slate-200"
                    >
                      {preset.name}
                    </button>
                    <button
                      onClick={() => deletePreset(preset.id)}
                      className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                      aria-label="Delete preset"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Reset Button */}
        <div className="flex-shrink-0 pt-2 border-t border-space-700">
          <button
            onClick={resetFilters}
            className="w-full px-4 py-2 bg-space-700 hover:bg-space-600 border border-space-600 text-slate-300 rounded-lg text-sm transition-colors"
          >
            Reset All Filters
          </button>
        </div>
      </div>
    </div>
  );
};
