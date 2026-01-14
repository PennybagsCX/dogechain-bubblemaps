/**
 * Performance Monitoring Service
 *
 * Tracks Core Web Vitals and search-specific performance metrics:
 * - Core Web Vitals (LCP, FID, CLS, INP, FCP, TTFB)
 * - Search response times
 * - Cache hit rates
 * - Resource loading times
 *
 * Uses PerformanceObserver API where available.
 */

interface Metric {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  timestamp: number;
}

interface SearchPerformanceMetric {
  query: string;
  type: string;
  responseTime: number;
  cacheHit: boolean;
  resultCount: number;
  timestamp: number;
}

interface ResourceTimingMetric {
  name: string;
  duration: number;
  size: number;
  timestamp: number;
}

// Core Web Vitals thresholds (from web.dev)
const VITAL_THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 }, // Largest Contentful Paint (ms)
  FID: { good: 100, poor: 300 }, // First Input Delay (ms)
  CLS: { good: 0.1, poor: 0.25 }, // Cumulative Layout Shift
  INP: { good: 200, poor: 500 }, // Interaction to Next Paint (ms)
  FCP: { good: 1800, poor: 3000 }, // First Contentful Paint (ms)
  TTFB: { good: 800, poor: 1800 }, // Time to First Byte (ms)
};

let metrics: Metric[] = [];
let searchMetrics: SearchPerformanceMetric[] = [];
let resourceMetrics: ResourceTimingMetric[] = [];

/**
 * Initialize performance monitoring
 */
export function initPerformanceMonitoring(): void {
  if (typeof window === "undefined") return;

  // Observe Core Web Vitals
  observeLCP();
  observeFID();
  observeCLS();
  observeINP();
  observeFCP();
  observeTTFB();

  // Observe resource timings
  observeResourceTimings();
}

/**
 * Observe Largest Contentful Paint (LCP)
 */
function observeLCP(): void {
  if (!("PerformanceObserver" in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as any;

      const metric: Metric = {
        name: "LCP",
        value: lastEntry.startTime,
        rating: getRating("LCP", lastEntry.startTime),
        timestamp: Date.now(),
      };

      recordMetric(metric);
    });

    observer.observe({ type: "largest-contentful-paint", buffered: true });
  } catch (error) {
    // Error handled silently
  }
}

/**
 * Observe First Input Delay (FID)
 */
function observeFID(): void {
  if (!("PerformanceObserver" in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (const entry of entries) {
        const fidEntry = entry as any;
        const metric: Metric = {
          name: "FID",
          value: fidEntry.processingStart - fidEntry.startTime,
          rating: getRating("FID", fidEntry.processingStart - fidEntry.startTime),
          timestamp: Date.now(),
        };

        recordMetric(metric);
      }
    });

    observer.observe({ type: "first-input", buffered: true });
  } catch (error) {
    // Error handled silently
  }
}

/**
 * Observe Cumulative Layout Shift (CLS)
 */
function observeCLS(): void {
  if (!("PerformanceObserver" in window)) return;

  let clsValue = 0;

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (const entry of entries) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
        }
      }

      const metric: Metric = {
        name: "CLS",
        value: clsValue,
        rating: getRating("CLS", clsValue),
        timestamp: Date.now(),
      };

      recordMetric(metric);
    });

    observer.observe({ type: "layout-shift", buffered: true });
  } catch (error) {
    // Error handled silently
  }
}

/**
 * Observe Interaction to Next Paint (INP)
 */
function observeINP(): void {
  if (!("PerformanceObserver" in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as any;

      const metric: Metric = {
        name: "INP",
        value: lastEntry.duration,
        rating: getRating("INP", lastEntry.duration),
        timestamp: Date.now(),
      };

      recordMetric(metric);
    });

    observer.observe({ type: "event", buffered: true });
  } catch (error) {
    // Error handled silently
  }
}

/**
 * Observe First Contentful Paint (FCP)
 */
function observeFCP(): void {
  if (!("PerformanceObserver" in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (const entry of entries) {
        const metric: Metric = {
          name: "FCP",
          value: entry.startTime,
          rating: getRating("FCP", entry.startTime),
          timestamp: Date.now(),
        };

        recordMetric(metric);
      }
    });

    observer.observe({
      type: "paint",
      buffered: true,
    });
  } catch (error) {
    // Error handled silently
  }
}

/**
 * Observe Time to First Byte (TTFB)
 */
function observeTTFB(): void {
  if (!("PerformanceObserver" in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (const entry of entries) {
        const navEntry = entry as PerformanceNavigationTiming;
        const metric: Metric = {
          name: "TTFB",
          value: navEntry.responseStart - navEntry.requestStart,
          rating: getRating("TTFB", navEntry.responseStart - navEntry.requestStart),
          timestamp: Date.now(),
        };

        recordMetric(metric);
      }
    });

    observer.observe({ type: "navigation", buffered: true });
  } catch (error) {
    // Error handled silently
  }
}

/**
 * Observe Resource Timings
 */
function observeResourceTimings(): void {
  if (!("PerformanceObserver" in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (const entry of entries) {
        const resourceEntry = entry as PerformanceResourceTiming;

        const metric: ResourceTimingMetric = {
          name: resourceEntry.name,
          duration: resourceEntry.duration,
          size: resourceEntry.transferSize,
          timestamp: Date.now(),
        };

        resourceMetrics.push(metric);
      }
    });

    observer.observe({ type: "resource", buffered: true });
  } catch (error) {
    // Error handled silently
  }
}

/**
 * Get performance rating based on thresholds
 */
function getRating(metricName: string, value: number): "good" | "needs-improvement" | "poor" {
  const threshold = (VITAL_THRESHOLDS as any)[metricName];
  if (!threshold) return "good";

  if (value <= threshold.good) return "good";
  if (value <= threshold.poor) return "needs-improvement";
  return "poor";
}

/**
 * Record a metric
 */
function recordMetric(metric: Metric): void {
  metrics.push(metric);
}

/**
 * Track search performance
 */
export function trackSearchPerformance(
  query: string,
  type: string,
  responseTime: number,
  cacheHit: boolean,
  resultCount: number
): void {
  const metric: SearchPerformanceMetric = {
    query,
    type,
    responseTime,
    cacheHit,
    resultCount,
    timestamp: Date.now(),
  };

  searchMetrics.push(metric);
}

/**
 * Get all recorded metrics
 */
export function getMetrics(): Metric[] {
  return [...metrics];
}

/**
 * Get search performance metrics
 */
export function getSearchMetrics(): SearchPerformanceMetric[] {
  return [...searchMetrics];
}

/**
 * Get resource timing metrics
 */
export function getResourceMetrics(): ResourceTimingMetric[] {
  return [...resourceMetrics];
}

/**
 * Get performance summary
 */
export function getPerformanceSummary(): {
  coreWebVitals: Record<string, Metric | null>;
  searchPerformance: {
    averageResponseTime: number;
    cacheHitRate: number;
    totalSearches: number;
  };
  resourceTimings: {
    averageDuration: number;
    totalSize: number;
    totalResources: number;
  };
} {
  // Core Web Vitals
  const coreWebVitals: Record<string, Metric | null> = {
    LCP: null,
    FID: null,
    CLS: null,
    INP: null,
    FCP: null,
    TTFB: null,
  };

  for (const metric of metrics) {
    if (metric.name in coreWebVitals && !coreWebVitals[metric.name as keyof typeof coreWebVitals]) {
      coreWebVitals[metric.name as keyof typeof coreWebVitals] = metric;
    }
  }

  // Search Performance
  const totalSearches = searchMetrics.length;
  const totalResponseTime = searchMetrics.reduce((sum, m) => sum + m.responseTime, 0);
  const averageResponseTime = totalSearches > 0 ? totalResponseTime / totalSearches : 0;

  const cacheHits = searchMetrics.filter((m) => m.cacheHit).length;
  const cacheHitRate = totalSearches > 0 ? (cacheHits / totalSearches) * 100 : 0;

  // Resource Timings
  const totalResources = resourceMetrics.length;
  const totalDuration = resourceMetrics.reduce((sum, m) => sum + m.duration, 0);
  const averageDuration = totalResources > 0 ? totalDuration / totalResources : 0;

  const totalSize = resourceMetrics.reduce((sum, m) => sum + m.size, 0);

  return {
    coreWebVitals,
    searchPerformance: {
      averageResponseTime,
      cacheHitRate,
      totalSearches,
    },
    resourceTimings: {
      averageDuration,
      totalSize,
      totalResources,
    },
  };
}

/**
 * Clear all metrics
 */
export function clearMetrics(): void {
  metrics = [];
  searchMetrics = [];
  resourceMetrics = [];
}

/**
 * Export metrics as JSON (for reporting)
 */
export function exportMetrics(): string {
  const summary = getPerformanceSummary();

  return JSON.stringify(
    {
      timestamp: Date.now(),
      summary,
      rawMetrics: {
        coreWebVitals: metrics,
        searchPerformance: searchMetrics,
        resourceTimings: resourceMetrics,
      },
    },
    null,
    2
  );
}

// Auto-initialize
if (typeof window !== "undefined") {
  // Initialize after page load
  if (document.readyState === "complete") {
    initPerformanceMonitoring();
  } else {
    window.addEventListener("load", initPerformanceMonitoring);
  }
}
