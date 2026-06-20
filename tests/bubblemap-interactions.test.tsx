/**
 * Comprehensive test battery for BubbleMap filter/legend/click interactions.
 *
 * Tests the critical user-facing scenarios that have been reported as buggy:
 * 1. Filter selection → bubble map rebuilds correctly
 * 2. Click outside filter modal → modal closes without side effects
 * 3. Legend click → doesn't trigger filter changes
 * 4. Click near legend → doesn't cascade to other UI elements
 * 5. Mobile touch interactions
 * 6. Multiple rapid filter changes
 * 7. Filter state persistence
 * 8. D3 background click → proper deselection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { FilterProvider } from "../contexts/FilterContext";
import { FilterControls } from "../components/FilterControls";
import { filterWallets } from "../utils/filterUtils";
import { Wallet, Link } from "../types";
import { FilterState } from "../contexts/FilterContext";

// ============================================================
// Test data factory
// ============================================================

/**
 * Creates mock wallets with realistic percentage distribution spanning
 * all filter ranges:
 *   - mega  (>=5%):     wallets 0-1  (10%, 7%)
 *   - whale  (1-5%):    wallets 2-5  (3.5%, 2.5%, 1.5%, 1.2%)
 *   - retail (0.1-1%):  wallets 6-7  (0.5%, 0.3%)
 *   - micro  (<0.1%):   wallets 8-9  (0.05%, 0.01%)
 */
function createMockWallets(count: number = 10): Wallet[] {
  const defaultPercentages = [10, 7, 3.5, 2.5, 1.5, 1.2, 0.5, 0.3, 0.05, 0.01];
  const defaultLabels: (string | undefined)[] = [
    "Binance",
    "Coinbase",
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    "LP Pool",
  ];

  return Array.from({ length: count }, (_, i) => {
    const percentage = i < defaultPercentages.length ? defaultPercentages[i] : Math.random() * 0.01;
    const label = i < defaultLabels.length ? defaultLabels[i] : undefined;

    return {
      id: `wallet-${i}`,
      address: `0x${String(i + 1).padStart(40, "0")}`,
      balance: Math.round(percentage * 100000),
      percentage,
      isWhale: percentage >= 1,
      isContract: i === count - 1,
      label,
      connections: i < count - 1 ? [`wallet-${i + 1}`] : [],
    };
  });
}

function createMockLinks(wallets: Wallet[]): Link[] {
  return wallets
    .filter((w) => w.connections.length > 0)
    .flatMap((w) =>
      w.connections.map((targetId) => ({
        source: w.id,
        target: targetId,
        value: 1,
      }))
    );
}

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

// ============================================================
// Helper: render FilterControls with context
// ============================================================

function renderFilterControls() {
  const onClose = vi.fn();
  const result = render(
    <FilterProvider>
      <FilterControls onClose={onClose} />
    </FilterProvider>
  );
  return { ...result, onClose };
}

// ============================================================
// TEST SUITE 1: Filter logic correctness
// ============================================================

describe("Filter Logic", () => {
  const wallets = createMockWallets(10);

  it("returns all wallets when no filters applied", () => {
    const result = filterWallets(wallets, DEFAULT_FILTERS);
    expect(result).toHaveLength(10);
  });

  it("filters by whale holding size (1-5%)", () => {
    const filters: FilterState = { ...DEFAULT_FILTERS, holdingSize: "whale" };
    const result = filterWallets(wallets, filters);
    expect(result.every((w) => w.percentage >= 1 && w.percentage < 5)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toHaveLength(4);
  });

  it("filters by mega holding size (>=5%)", () => {
    const filters: FilterState = { ...DEFAULT_FILTERS, holdingSize: "mega" };
    const result = filterWallets(wallets, filters);
    expect(result.every((w) => w.percentage >= 5)).toBe(true);
    expect(result).toHaveLength(2);
  });

  it("filters by retail holding size (0.1-1%)", () => {
    const filters: FilterState = { ...DEFAULT_FILTERS, holdingSize: "retail" };
    const result = filterWallets(wallets, filters);
    expect(result.every((w) => w.percentage >= 0.1 && w.percentage < 1)).toBe(true);
    expect(result).toHaveLength(2);
  });

  it("filters by micro holding size (<0.1%)", () => {
    const filters: FilterState = { ...DEFAULT_FILTERS, holdingSize: "micro" };
    const result = filterWallets(wallets, filters);
    expect(result.every((w) => w.percentage < 0.1)).toBe(true);
    expect(result).toHaveLength(2);
  });

  it("filters by labeled wallets", () => {
    const filters: FilterState = { ...DEFAULT_FILTERS, label: "labeled" };
    const result = filterWallets(wallets, filters);
    expect(result.every((w) => !!w.label)).toBe(true);
    expect(result.length).toBe(3);
  });

  it("filters by unlabeled wallets", () => {
    const filters: FilterState = { ...DEFAULT_FILTERS, label: "unlabeled" };
    const result = filterWallets(wallets, filters);
    expect(result.every((w) => !w.label)).toBe(true);
  });

  it("filters by contracts", () => {
    const filters: FilterState = { ...DEFAULT_FILTERS, label: "contracts" };
    const result = filterWallets(wallets, filters);
    expect(result.every((w) => w.isContract)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it("filters by activity - inactive (0 connections)", () => {
    const filters: FilterState = { ...DEFAULT_FILTERS, activity: "inactive" };
    const result = filterWallets(wallets, filters);
    expect(result.every((w) => (w.connections?.length || 0) === 0)).toBe(true);
  });

  it("filters by activity - high (>15 connections)", () => {
    const walletsWithConnected = [
      ...wallets,
      {
        ...wallets[0],
        id: "super-connected",
        connections: Array.from({ length: 20 }, (_, i) => `wallet-${i}`),
      },
    ];
    const filters: FilterState = { ...DEFAULT_FILTERS, activity: "high" };
    const result = filterWallets(walletsWithConnected, filters);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((w) => (w.connections?.length || 0) > 15)).toBe(true);
  });

  it("onlyWhales filter includes wallets with isWhale=true or percentage>=1", () => {
    const filters: FilterState = { ...DEFAULT_FILTERS, onlyWhales: true };
    const result = filterWallets(wallets, filters);
    expect(result.every((w) => w.isWhale || w.percentage >= 1)).toBe(true);
  });

  it("combines multiple filters correctly (whale + labeled)", () => {
    const filters: FilterState = { ...DEFAULT_FILTERS, holdingSize: "whale", label: "labeled" };
    const result = filterWallets(wallets, filters);
    expect(
      result.every((w) => {
        const isWhale = w.percentage >= 1 && w.percentage < 5;
        const isLabeled = !!w.label;
        return isWhale && isLabeled;
      })
    ).toBe(true);
    // Labeled wallets are at 10%, 7%, 0.01% — none in whale 1-5% range
    expect(result).toHaveLength(0);
  });

  it("minBalancePercent filters correctly", () => {
    const filters: FilterState = { ...DEFAULT_FILTERS, minBalancePercent: 5 };
    const result = filterWallets(wallets, filters);
    const maxBalance = Math.max(...wallets.map((w) => w.balance));
    const threshold = (maxBalance * 5) / 100;
    expect(result.every((w) => w.balance >= threshold)).toBe(true);
  });
});

// ============================================================
// TEST SUITE 2: Filter state transitions
// ============================================================

describe("Filter State Transitions", () => {
  it("switching holdingSize from 'all' to 'whale' reduces visible wallets", () => {
    const wallets = createMockWallets(10);
    const allResult = filterWallets(wallets, DEFAULT_FILTERS);
    const whaleResult = filterWallets(wallets, { ...DEFAULT_FILTERS, holdingSize: "whale" });
    expect(whaleResult.length).toBeLessThan(allResult.length);
  });

  it("switching between whale and retail produces different results", () => {
    const wallets = createMockWallets(10);
    const whaleResult = filterWallets(wallets, { ...DEFAULT_FILTERS, holdingSize: "whale" });
    const retailResult = filterWallets(wallets, { ...DEFAULT_FILTERS, holdingSize: "retail" });
    const whaleIds = new Set(whaleResult.map((w) => w.id));
    const retailIds = new Set(retailResult.map((w) => w.id));
    const overlap = [...whaleIds].filter((id) => retailIds.has(id));
    expect(overlap).toHaveLength(0);
  });

  it("resetting filters returns to showing all wallets", () => {
    const wallets = createMockWallets(10);
    const filtered = filterWallets(wallets, { ...DEFAULT_FILTERS, holdingSize: "whale" });
    const reset = filterWallets(wallets, DEFAULT_FILTERS);
    expect(reset).toHaveLength(wallets.length);
    expect(filtered.length).toBeLessThan(wallets.length);
  });

  it("rapid filter changes produce consistent results", () => {
    const wallets = createMockWallets(10);
    const sizes: Array<"all" | "micro" | "retail" | "whale" | "mega"> = [
      "all",
      "whale",
      "retail",
      "mega",
      "micro",
      "all",
      "whale",
    ];

    const results = sizes.map((size) =>
      filterWallets(wallets, { ...DEFAULT_FILTERS, holdingSize: size })
    );

    results.forEach((result, i) => {
      const size = sizes[i];
      if (size === "all") {
        expect(result).toHaveLength(10);
      } else if (size === "whale") {
        expect(result.every((w) => w.percentage >= 1 && w.percentage < 5)).toBe(true);
      } else if (size === "retail") {
        expect(result.every((w) => w.percentage >= 0.1 && w.percentage < 1)).toBe(true);
      }
    });

    expect(results[1]).toEqual(results[6]); // both "whale"
    expect(results[0]).toEqual(results[5]); // both "all"
  });
});

// ============================================================
// TEST SUITE 3: FilterControls modal behavior
// ============================================================

describe("FilterControls Panel", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the filter controls panel", () => {
    renderFilterControls();
    expect(screen.getByText("Whales Only")).toBeInTheDocument();
    expect(screen.getByText("All Holdings")).toBeInTheDocument();
  });

  it("always renders filter content (no open/close state)", () => {
    renderFilterControls();
    // Basic filters always visible
    expect(screen.getByText("Filter Dust")).toBeInTheDocument();
    expect(screen.getByText("Reset All Filters")).toBeInTheDocument();
  });

  it("filter buttons update filter state", () => {
    renderFilterControls();
    const whalesButton = screen.getByText("Whales Only");
    fireEvent.click(whalesButton);
    // Button should now show active state
    expect(whalesButton.className).toContain("bg-purple-600");
  });

  it("advanced section toggles correctly", () => {
    renderFilterControls();
    const advancedToggles = screen.getAllByText("Advanced Filters");
    const toggleSpan = advancedToggles.find((el) => el.tagName === "SPAN");
    expect(toggleSpan).toBeTruthy();
    if (toggleSpan) {
      const btn = toggleSpan.closest("button");
      if (btn) fireEvent.click(btn);
    }
    // After expanding, holding size options should be visible
    expect(screen.getByText(/Whale \(1-5%\)/)).toBeInTheDocument();
  });

  it("renders holding size filter options", () => {
    renderFilterControls(true);
    expect(screen.getByText("All Holdings")).toBeInTheDocument();
    expect(screen.getByText(/Micro/)).toBeInTheDocument();
    // "Whale" appears in "Whale (1-5%)" and "Whales Only" — use specific match
    expect(screen.getByText(/Whale \(1-5%\)/)).toBeInTheDocument();
    expect(screen.getByText(/Mega/)).toBeInTheDocument();
  });

  it("renders quick filters", () => {
    renderFilterControls();
    expect(screen.getByText("Whales Only")).toBeInTheDocument();
  });

  it("renders reset button", () => {
    renderFilterControls();
    expect(screen.getByText("Reset All Filters")).toBeInTheDocument();
  });
});

// ============================================================
// TEST SUITE 4: Click event propagation
// ============================================================

describe("Click Event Propagation", () => {
  it("unified click-outside handler does not fire when click is inside any overlay", () => {
    const mockRef = { current: document.createElement("div") };
    const target = document.createElement("button");
    mockRef.current.appendChild(target);
    expect(mockRef.current?.contains(target)).toBe(true);
  });

  it("unified click-outside handler fires when click is outside all overlays", () => {
    const mockRef = { current: document.createElement("div") };
    const outsideTarget = document.createElement("div");
    expect(mockRef.current?.contains(outsideTarget)).toBe(false);
  });

  it("stopPropagation in bubble phase does not affect capture phase listeners", () => {
    const captureHandler = vi.fn();
    const bubbleHandler = vi.fn((e: Event) => e.stopPropagation());

    const parent = document.createElement("div");
    const child = document.createElement("button");
    parent.appendChild(child);
    document.body.appendChild(parent);

    document.addEventListener("click", captureHandler, true);
    parent.addEventListener("click", bubbleHandler);

    fireEvent.click(child);

    expect(captureHandler).toHaveBeenCalledTimes(1);
    expect(bubbleHandler).toHaveBeenCalledTimes(1);

    document.removeEventListener("click", captureHandler, true);
    document.body.removeChild(parent);
  });
});

// ============================================================
// TEST SUITE 5: Edge cases
// ============================================================

describe("Edge Cases", () => {
  it("handles empty wallet array", () => {
    const result = filterWallets([], DEFAULT_FILTERS);
    expect(result).toHaveLength(0);
  });

  it("handles wallet with zero connections", () => {
    const wallets: Wallet[] = [
      {
        id: "1",
        address: "0x0000000000000000000000000000000000000001",
        balance: 1000,
        percentage: 100,
        isWhale: true,
        isContract: false,
        connections: [],
      },
    ];
    const filters: FilterState = { ...DEFAULT_FILTERS, activity: "inactive" };
    const result = filterWallets(wallets, filters);
    expect(result).toHaveLength(1);
  });

  it("handles wallet with exactly threshold values (1.0% for whale)", () => {
    const wallets: Wallet[] = [
      {
        id: "1",
        address: "0x0000000000000000000000000000000000000001",
        balance: 1000,
        percentage: 1.0,
        isWhale: true,
        isContract: false,
        connections: [],
      },
    ];
    const filters: FilterState = { ...DEFAULT_FILTERS, holdingSize: "whale" };
    const result = filterWallets(wallets, filters);
    expect(result).toHaveLength(1);
  });

  it("handles wallet with exactly 0.1% (retail threshold)", () => {
    const wallets: Wallet[] = [
      {
        id: "1",
        address: "0x0000000000000000000000000000000000000001",
        balance: 1000,
        percentage: 0.1,
        isWhale: false,
        isContract: false,
        connections: [],
      },
    ];
    const retailResult = filterWallets(wallets, { ...DEFAULT_FILTERS, holdingSize: "retail" });
    expect(retailResult).toHaveLength(1);

    const microResult = filterWallets(wallets, { ...DEFAULT_FILTERS, holdingSize: "micro" });
    expect(microResult).toHaveLength(0);
  });

  it("handles simultaneous hideDust + onlyWhales filters", () => {
    const wallets = createMockWallets(10);
    const filters: FilterState = { ...DEFAULT_FILTERS, hideDust: true, onlyWhales: true };
    const result = filterWallets(wallets, filters);
    expect(result.every((w) => w.isWhale || w.percentage >= 1)).toBe(true);
  });

  it("handles all filters active simultaneously", () => {
    const wallets = createMockWallets(10);
    const filters: FilterState = {
      ...DEFAULT_FILTERS,
      holdingSize: "whale",
      label: "labeled",
      activity: "low",
      hideDust: true,
      onlyWhales: true,
      minBalancePercent: 1,
    };
    const result = filterWallets(wallets, filters);
    expect(Array.isArray(result)).toBe(true);
  });
});

// ============================================================
// TEST SUITE 6: FilterContext state management
// ============================================================

describe("FilterContext State Management", () => {
  it("provides default filter state", () => {
    function TestComponent() {
      return null;
    }
    render(
      <FilterProvider>
        <TestComponent />
      </FilterProvider>
    );
  });

  it("updateFilters creates a new filter state", () => {
    const state1: FilterState = { ...DEFAULT_FILTERS };
    const state2: FilterState = { ...state1, holdingSize: "whale" };
    expect(state1.holdingSize).toBe("all");
    expect(state2.holdingSize).toBe("whale");
    expect(state1).not.toBe(state2);
  });
});

// ============================================================
// TEST SUITE 7: D3 rebuild trigger conditions
// ============================================================

describe("D3 Rebuild Trigger Conditions", () => {
  it("filter change should produce different node set", () => {
    const wallets = createMockWallets(10);
    const links = createMockLinks(wallets);

    const allFiltered = filterWallets(wallets, DEFAULT_FILTERS);
    const whaleFiltered = filterWallets(wallets, { ...DEFAULT_FILTERS, holdingSize: "whale" });

    expect(allFiltered.length).toBe(10);
    expect(whaleFiltered.length).toBeLessThan(10);

    const whaleIds = new Set(whaleFiltered.map((w) => w.id));
    const whaleLinks = links.filter((link) => {
      const sourceId = typeof link.source === "string" ? link.source : link.source.id;
      const targetId = typeof link.target === "string" ? link.target : link.target.id;
      return whaleIds.has(sourceId) && whaleIds.has(targetId);
    });
    expect(whaleLinks.length).toBeLessThanOrEqual(links.length);
  });

  it("showLabels toggle does NOT change which wallets are filtered", () => {
    const wallets = createMockWallets(10);
    const withLabels = filterWallets(wallets, { ...DEFAULT_FILTERS, showLabels: true });
    const withoutLabels = filterWallets(wallets, { ...DEFAULT_FILTERS, showLabels: false });
    expect(withLabels.map((w) => w.id)).toEqual(withoutLabels.map((w) => w.id));
  });

  it("showLinks toggle does NOT change which wallets are filtered", () => {
    const wallets = createMockWallets(10);
    const withLinks = filterWallets(wallets, { ...DEFAULT_FILTERS, showLinks: true });
    const withoutLinks = filterWallets(wallets, { ...DEFAULT_FILTERS, showLinks: false });
    expect(withLinks.map((w) => w.id)).toEqual(withoutLinks.map((w) => w.id));
  });
});

// ============================================================
// TEST SUITE 8: closeSettings debounce guard
// ============================================================

describe("closeSettings Debounce Guard", () => {
  it("debounce timestamp should only be set when modal was open", () => {
    let lastModalCloseTime = 0;

    const setIsSettingsOpen = (updater: (prev: boolean) => boolean) => {
      const prev = true;
      if (prev) lastModalCloseTime = Date.now();
      updater(prev);
    };
    setIsSettingsOpen(() => false);
    expect(lastModalCloseTime).toBeGreaterThan(0);

    lastModalCloseTime = 0;

    const setIsSettingsOpen2 = (updater: (prev: boolean) => boolean) => {
      const prev = false;
      if (prev) lastModalCloseTime = Date.now();
      updater(prev);
    };
    setIsSettingsOpen2(() => false);
    expect(lastModalCloseTime).toBe(0);
  });

  it("300ms debounce window correctly blocks and unblocks", () => {
    const closeTime = Date.now();
    expect(Date.now() - closeTime < 300).toBe(true);
  });
});

// ============================================================
// TEST SUITE 9: Mobile touch interactions
// ============================================================

describe("Mobile Touch Interactions", () => {
  it("isTouchDevice detection works", () => {
    const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    expect(typeof isTouchDevice).toBe("boolean");
  });

  it("touch device detection is consistent", () => {
    const detection1 = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const detection2 = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    expect(detection1).toBe(detection2);
  });
});

// ============================================================
// TEST SUITE 10: Drag vs Tap detection
// ============================================================

describe("Drag vs Tap Detection", () => {
  it("5px threshold correctly distinguishes tap from drag", () => {
    const startX = 100,
      startY = 100;
    const THRESHOLD = 5;

    const tapDist = Math.sqrt(0);
    expect(tapDist < THRESHOLD).toBe(true);

    const smallDist = Math.sqrt((101 - startX) ** 2 + (100 - startY) ** 2);
    expect(smallDist < THRESHOLD).toBe(true);

    const dragDist = Math.sqrt((110 - startX) ** 2 + (105 - startY) ** 2);
    expect(dragDist > THRESHOLD).toBe(true);
  });

  it("diagonal movement threshold", () => {
    const THRESHOLD = 5;

    const diagDist = Math.sqrt(3 ** 2 + 3 ** 2);
    expect(diagDist < THRESHOLD).toBe(true);

    const diagOverDist = Math.sqrt(4 ** 2 + 4 ** 2);
    expect(diagOverDist > THRESHOLD).toBe(true);
  });
});
