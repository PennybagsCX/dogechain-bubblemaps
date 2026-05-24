import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";

export type HoldingSizeFilter = "all" | "micro" | "retail" | "whale" | "mega";
export type LabelFilter = "all" | "labeled" | "unlabeled" | "contracts";
export type ActivityFilter = "all" | "inactive" | "low" | "medium" | "high";

export interface FilterPreset {
  id: string;
  name: string;
  filters: FilterState;
  createdAt: number;
}

export interface FilterState {
  // Basic filters
  showLinks: boolean;
  showLabels: boolean;
  minBalancePercent: number;

  // Advanced filters
  holdingSize: HoldingSizeFilter;
  label: LabelFilter;
  activity: ActivityFilter;
  customTags: string[];

  // Quick filters
  hideDust: boolean;
  hideContracts: boolean;
  onlyWhales: boolean;
}

interface FilterContextType {
  filters: FilterState;
  presets: FilterPreset[];
  updateFilters: (updates: Partial<FilterState>) => void;
  resetFilters: () => void;
  savePreset: (name: string) => void;
  loadPreset: (id: string) => void;
  deletePreset: (id: string) => void;
  applyPreset: (preset: FilterPreset) => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

const DEFAULT_FILTERS: FilterState = {
  showLinks: true,
  showLabels: true,
  minBalancePercent: 0,
  holdingSize: "all",
  label: "all",
  activity: "all",
  customTags: [],
  hideDust: false,
  hideContracts: false,
  onlyWhales: false,
};

// Storage keys
const FILTERS_STORAGE_KEY = "bubblemap_filters";
const PRESETS_STORAGE_KEY = "bubblemap_filter_presets";

export const FilterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [filters, setFilters] = useState<FilterState>(() => {
    if (typeof window === "undefined") return DEFAULT_FILTERS;

    try {
      const saved = localStorage.getItem(FILTERS_STORAGE_KEY);
      return saved ? { ...DEFAULT_FILTERS, ...JSON.parse(saved) } : DEFAULT_FILTERS;
    } catch {
      return DEFAULT_FILTERS;
    }
  });

  const [presets, setPresets] = useState<FilterPreset[]>(() => {
    if (typeof window === "undefined") return [];

    try {
      const saved = localStorage.getItem(PRESETS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Persist filters to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
    } catch (error) {
      console.error("Failed to save filters:", error);
    }
  }, [filters]);

  // Persist presets to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
    } catch (error) {
      console.error("Failed to save presets:", error);
    }
  }, [presets]);

  const updateFilters = useCallback((updates: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const savePreset = useCallback(
    (name: string) => {
      const preset: FilterPreset = {
        id: `preset_${Date.now()}`,
        name,
        filters: { ...filters },
        createdAt: Date.now(),
      };
      setPresets((prev) => [...prev, preset]);
    },
    [filters]
  );

  const loadPreset = useCallback(
    (id: string) => {
      const preset = presets.find((p) => p.id === id);
      if (preset) {
        setFilters(preset.filters);
      }
    },
    [presets]
  );

  const deletePreset = useCallback((id: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const applyPreset = useCallback((preset: FilterPreset) => {
    setFilters(preset.filters);
  }, []);

  return (
    <FilterContext.Provider
      value={{
        filters,
        presets,
        updateFilters,
        resetFilters,
        savePreset,
        loadPreset,
        deletePreset,
        applyPreset,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
};

export const useFilters = () => {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error("useFilters must be used within a FilterProvider");
  }
  return context;
};
