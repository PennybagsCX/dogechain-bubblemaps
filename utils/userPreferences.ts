/**
 * Local storage utilities for user preferences
 */

const CHART_HEIGHT_KEY = "dogechain-bubblemaps-chart-height";

export type ChartHeight = "sm" | "md" | "lg";

const CHART_HEIGHT_CLASSES: Record<ChartHeight, string> = {
  sm: "h-[300px]", // Mobile
  md: "h-[400px]", // Tablet
  lg: "h-[500px]", // Desktop
};

const CHART_HEIGHT_LABELS: Record<ChartHeight, string> = {
  sm: "Small",
  md: "Medium",
  lg: "Large",
};

/**
 * Get saved chart height preference
 */
export function getChartHeight(): ChartHeight {
  if (typeof window === "undefined") return "lg";

  try {
    const saved = localStorage.getItem(CHART_HEIGHT_KEY);
    if (saved && (saved === "sm" || saved === "md" || saved === "lg")) {
      return saved;
    }
  } catch (e) {
    console.warn("[chartHeight] Failed to read from localStorage:", e);
  }

  return "lg"; // Default
}

/**
 * Set chart height preference
 */
export function setChartHeight(height: ChartHeight): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(CHART_HEIGHT_KEY, height);
    console.log("[chartHeight] Saved preference:", height);
  } catch (e) {
    console.warn("[chartHeight] Failed to write to localStorage:", e);
  }
}

/**
 * Get CSS class string for chart height
 */
export function getChartHeightClass(height?: ChartHeight): string {
  const h = height || getChartHeight();
  return CHART_HEIGHT_CLASSES[h];
}

/**
 * Get label for chart height
 */
export function getChartHeightLabel(height?: ChartHeight): string {
  const h = height || getChartHeight();
  return CHART_HEIGHT_LABELS[h];
}

/**
 * Get all available chart heights
 */
export function getAvailableChartHeights(): { value: ChartHeight; label: string; class: string }[] {
  return Object.entries(CHART_HEIGHT_LABELS).map(([value, label]) => ({
    value: value as ChartHeight,
    label,
    class: CHART_HEIGHT_CLASSES[value as ChartHeight],
  }));
}
