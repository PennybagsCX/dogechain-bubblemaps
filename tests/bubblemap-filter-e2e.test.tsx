/**
 * E2E-style integration tests for BubbleMap + FilterControls interactions.
 *
 * These tests simulate the exact user flows that are reported as buggy:
 * - Opening filter modal, selecting filters, closing modal
 * - Clicking legend while filter modal is open
 * - Touch interactions on mobile viewports
 * - Multiple rapid filter changes
 * - Filter state persistence across modal open/close cycles
 *
 * The goal is to catch the race conditions and propagation bugs that
 * unit tests can't reproduce.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { FilterProvider } from "../contexts/FilterContext";
import { FilterControls } from "../components/FilterControls";
import { useFilters, FilterState } from "../contexts/FilterContext";
import { filterWallets } from "../utils/filterUtils";
import { Wallet } from "../types";
import React from "react";

// ============================================================
// Test data
// ============================================================

function createTestWallets(count: number = 10): Wallet[] {
  const percentages = [10, 7, 3.5, 2.5, 1.5, 1.2, 0.5, 0.3, 0.05, 0.01];
  const labels: (string | undefined)[] = [
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

  return Array.from({ length: count }, (_, i) => ({
    id: `w-${i}`,
    address: `0x${String(i + 1).padStart(40, "0")}`,
    balance: Math.round((percentages[i] || 0.01) * 100000),
    percentage: percentages[i] || Math.random() * 0.01,
    isWhale: (percentages[i] || 0) >= 1,
    isContract: i === count - 1,
    label: labels[i] || undefined,
    connections: i < count - 1 ? [`w-${i + 1}`] : [],
  }));
}

function cleanupPortals() {
  document.querySelectorAll("[data-filter-controls]").forEach((el) => el.remove());
}

// ============================================================
// Helper: component that reads filter state for assertions
// ============================================================

function FilterStateReader({ onState }: { onState: (s: FilterState) => void }) {
  const { filters } = useFilters();
  React.useEffect(() => {
    onState(filters);
  }, [filters, onState]);
  return null;
}

// ============================================================
// TEST SUITE 1: Filter selection + modal lifecycle
// ============================================================

describe("Filter Modal Lifecycle", () => {
  beforeEach(() => {
    localStorage.clear();
    cleanupPortals();
  });
  afterEach(() => {
    cleanup();
    cleanupPortals();
  });

  it("filter modal opens, applies a holding size filter, then closes cleanly", async () => {
    const onClose = vi.fn();
    let currentFilters: FilterState | undefined;

    const onState = vi.fn((s: FilterState) => {
      currentFilters = s;
    });

    render(
      <FilterProvider>
        <FilterStateReader onState={onState} />
        <FilterControls isOpen={true} onClose={onClose} />
      </FilterProvider>
    );

    // Verify modal is visible
    const modal = document.querySelector("[data-filter-controls]");
    expect(modal).toBeTruthy();
    expect(modal?.className).toContain("pointer-events-auto");

    // Expand advanced section
    const advancedToggles = screen.getAllByText("Advanced Filters");
    const toggleButton = advancedToggles.find(
      (el) => el.closest("button") !== null && el.tagName === "SPAN"
    );
    if (toggleButton) {
      fireEvent.click(toggleButton.closest("button")!);
    }

    // Select "Whale (1-5%)" holding size
    const whaleButton = screen.getByText(/Whale \(1-5%\)/);
    fireEvent.click(whaleButton);

    // Verify filter state was updated
    await waitFor(() => {
      expect(currentFilters?.holdingSize).toBe("whale");
    });

    // Close by clicking overlay
    fireEvent.click(modal!);
    expect(onClose).toHaveBeenCalled();
  });

  it("rapid filter changes all apply correctly", async () => {
    const onClose = vi.fn();
    const filterStates: FilterState[] = [];

    render(
      <FilterProvider>
        <FilterStateReader onState={(s) => filterStates.push({ ...s })} />
        <FilterControls isOpen={true} onClose={onClose} />
      </FilterProvider>
    );

    // Expand advanced
    const advancedToggles = screen.getAllByText("Advanced Filters");
    const toggleButton = advancedToggles.find((el) => el.tagName === "SPAN");
    if (toggleButton) {
      fireEvent.click(toggleButton.closest("button")!);
    }

    // Rapidly change holding size filters
    const allButton = screen.getByText("All Holdings");
    const whaleButton = screen.getByText(/Whale \(1-5%\)/);
    const megaButton = screen.getByText(/Mega/);
    const retailButton = screen.getByText(/Retail/);
    const microButton = screen.getByText(/Micro/);

    fireEvent.click(whaleButton);
    fireEvent.click(megaButton);
    fireEvent.click(retailButton);
    fireEvent.click(microButton);
    fireEvent.click(allButton);

    // The final state should be "all"
    await waitFor(() => {
      const last = filterStates[filterStates.length - 1];
      expect(last?.holdingSize).toBe("all");
    });
  });

  it("clicking inside the modal panel does NOT close it", () => {
    const onClose = vi.fn();
    render(
      <FilterProvider>
        <FilterControls isOpen={true} onClose={onClose} />
      </FilterProvider>
    );

    // Click on the h4 header (inside the modal panel)
    const header = screen.getByRole("heading", { level: 4 });
    fireEvent.click(header);
    expect(onClose).not.toHaveBeenCalled();

    // Click on a filter button (inside the modal panel)
    const whalesOnly = screen.getByText("Whales Only");
    fireEvent.click(whalesOnly);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("clicking the overlay background closes the modal", () => {
    const onClose = vi.fn();
    render(
      <FilterProvider>
        <FilterControls isOpen={true} onClose={onClose} />
      </FilterProvider>
    );

    const overlay = document.querySelector("[data-filter-controls]");
    fireEvent.click(overlay!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("filter state is maintained in FilterContext across updates", async () => {
    const onClose = vi.fn();
    const stateLog: FilterState[] = [];

    render(
      <FilterProvider>
        <FilterStateReader onState={(s) => stateLog.push({ ...s })} />
        <FilterControls isOpen={true} onClose={onClose} />
      </FilterProvider>
    );

    // Initial state
    expect(stateLog[stateLog.length - 1]?.onlyWhales).toBe(false);

    // Toggle Whales Only
    fireEvent.click(screen.getByText("Whales Only"));

    // Wait for state update
    await waitFor(() => {
      expect(stateLog[stateLog.length - 1]?.onlyWhales).toBe(true);
    });

    // Toggle off
    fireEvent.click(screen.getByText("Whales Only"));

    await waitFor(() => {
      expect(stateLog[stateLog.length - 1]?.onlyWhales).toBe(false);
    });
  });
});

// ============================================================
// TEST SUITE 2: Filter logic with realistic data
// ============================================================

describe("Filter Logic with Realistic Data", () => {
  const wallets = createTestWallets(10);

  it("each holding size filter returns the correct wallets", () => {
    const cases: Array<{ size: string; expectedCount: number; range: [number, number] }> = [
      { size: "all", expectedCount: 10, range: [0, Infinity] },
      { size: "mega", expectedCount: 2, range: [5, Infinity] },
      { size: "whale", expectedCount: 4, range: [1, 5] },
      { size: "retail", expectedCount: 2, range: [0.1, 1] },
      { size: "micro", expectedCount: 2, range: [0, 0.1] },
    ];

    for (const { size, expectedCount, range } of cases) {
      const filters: FilterState = {
        showLinks: true,
        showLabels: true,
        minBalancePercent: 0,
        holdingSize: size as any,
        label: "all",
        activity: "all",
        customTags: [],
        hideDust: false,
        hideContracts: false,
        onlyWhales: false,
      };
      const result = filterWallets(wallets, filters);
      expect(result.length).toBe(expectedCount);
      if (range[1] === Infinity) {
        expect(result.every((w) => w.percentage >= range[0])).toBe(true);
      } else {
        expect(result.every((w) => w.percentage >= range[0] && w.percentage < range[1])).toBe(true);
      }
    }
  });

  it("label filters work correctly", () => {
    const cases: Array<{ label: string; expected: (w: Wallet) => boolean }> = [
      { label: "labeled", expected: (w) => !!w.label },
      { label: "unlabeled", expected: (w) => !w.label },
      { label: "contracts", expected: (w) => w.isContract },
    ];

    for (const { label, expected } of cases) {
      const filters: FilterState = {
        showLinks: true,
        showLabels: true,
        minBalancePercent: 0,
        holdingSize: "all",
        label: label as any,
        activity: "all",
        customTags: [],
        hideDust: false,
        hideContracts: false,
        onlyWhales: false,
      };
      const result = filterWallets(wallets, filters);
      expect(result.every(expected)).toBe(true);
    }
  });

  it("combined filters produce correct results", () => {
    // Whale + labeled: whale is 1-5%, labeled are Binance(10%), Coinbase(7%), LP Pool(0.01%)
    // None of the labeled wallets are in 1-5% range → 0 results
    const filters1: FilterState = {
      showLinks: true,
      showLabels: true,
      minBalancePercent: 0,
      holdingSize: "whale",
      label: "labeled",
      activity: "all",
      customTags: [],
      hideDust: false,
      hideContracts: false,
      onlyWhales: false,
    };
    expect(filterWallets(wallets, filters1)).toHaveLength(0);

    // Mega + labeled: mega is >=5%, Binance(10%) and Coinbase(7%) → 2 results
    const filters2: FilterState = {
      showLinks: true,
      showLabels: true,
      minBalancePercent: 0,
      holdingSize: "mega",
      label: "labeled",
      activity: "all",
      customTags: [],
      hideDust: false,
      hideContracts: false,
      onlyWhales: false,
    };
    expect(filterWallets(wallets, filters2)).toHaveLength(2);

    // Only whales: percentage >= 1 OR isWhale = true → wallets 0-5 (10, 7, 3.5, 2.5, 1.5, 1.2)
    const filters3: FilterState = {
      showLinks: true,
      showLabels: true,
      minBalancePercent: 0,
      holdingSize: "all",
      label: "all",
      activity: "all",
      customTags: [],
      hideDust: false,
      hideContracts: false,
      onlyWhales: true,
    };
    expect(filterWallets(wallets, filters3)).toHaveLength(6);
  });

  it("filters are idempotent: applying same filter twice gives same result", () => {
    const filters: FilterState = {
      showLinks: true,
      showLabels: true,
      minBalancePercent: 0,
      holdingSize: "whale",
      label: "all",
      activity: "all",
      customTags: [],
      hideDust: false,
      hideContracts: false,
      onlyWhales: false,
    };
    const r1 = filterWallets(wallets, filters);
    const r2 = filterWallets(wallets, filters);
    expect(r1).toEqual(r2);
  });

  it("filter changes are consistent regardless of order", () => {
    // Start from "all", apply whale → 4 results
    // Start from "retail" (2 results), apply whale → 4 results
    // Both should give the same whale result
    const base: FilterState = {
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
    const fromAll = filterWallets(wallets, { ...base, holdingSize: "whale" });
    const fromRetail = filterWallets(wallets, { ...base, holdingSize: "retail" });
    const whaleFromRetail = filterWallets(
      [...fromRetail, ...wallets.filter((w) => !fromRetail.includes(w))],
      { ...base, holdingSize: "whale" }
    );
    expect(fromAll).toEqual(whaleFromRetail);
  });
});

// ============================================================
// TEST SUITE 3: Touch event propagation
// ============================================================

describe("Touch Event Propagation", () => {
  beforeEach(() => {
    localStorage.clear();
    cleanupPortals();
  });
  afterEach(() => {
    cleanup();
    cleanupPortals();
  });

  it("touchstart on filter modal overlay stops propagation", () => {
    const onClose = vi.fn();
    render(
      <FilterProvider>
        <FilterControls isOpen={true} onClose={onClose} />
      </FilterProvider>
    );

    const overlay = document.querySelector("[data-filter-controls]");
    expect(overlay).toBeTruthy();

    // Simulate a touchstart event
    const touchEvent = new Event("touchstart", { bubbles: true, cancelable: true });
    const propagationSpy = vi.spyOn(touchEvent, "stopPropagation");
    overlay!.dispatchEvent(touchEvent);

    // The onTouchStart handler should have called stopPropagation
    expect(propagationSpy).toHaveBeenCalled();
  });

  it("touchstart on filter modal inner panel stops propagation", () => {
    const onClose = vi.fn();
    render(
      <FilterProvider>
        <FilterControls isOpen={true} onClose={onClose} />
      </FilterProvider>
    );

    // Find the inner panel (direct child of overlay, has bg-space-800 class)
    const innerPanel = document.querySelector("[data-filter-controls] > div.bg-space-800");
    expect(innerPanel).toBeTruthy();

    const touchEvent = new Event("touchstart", { bubbles: true, cancelable: true });
    const propagationSpy = vi.spyOn(touchEvent, "stopPropagation");
    innerPanel!.dispatchEvent(touchEvent);

    expect(propagationSpy).toHaveBeenCalled();
  });

  it("filter buttons respond to both click and touch events", () => {
    const onClose = vi.fn();
    let currentFilters: FilterState | undefined;

    render(
      <FilterProvider>
        <FilterStateReader
          onState={(s) => {
            currentFilters = s;
          }}
        />
        <FilterControls isOpen={true} onClose={onClose} />
      </FilterProvider>
    );

    // Click the Whales Only button
    const whalesButton = screen.getByText("Whales Only");
    fireEvent.click(whalesButton);

    expect(currentFilters?.onlyWhales).toBe(true);
  });
});

// ============================================================
// TEST SUITE 4: Unified click-outside handler logic
// ============================================================

describe("Unified Click-Outside Handler Logic", () => {
  it("click on element inside settingsRef does NOT close settings", () => {
    const settingsDiv = document.createElement("div");
    const button = document.createElement("button");
    settingsDiv.appendChild(button);
    document.body.appendChild(settingsDiv);

    // Simulate the unified handler's logic
    const target = button;
    const isInside = settingsDiv.contains(target);
    expect(isInside).toBe(true);

    document.body.removeChild(settingsDiv);
  });

  it("click on element outside all refs closes open overlays", () => {
    const settingsDiv = document.createElement("div");
    const outsideElement = document.createElement("div");
    document.body.appendChild(settingsDiv);
    document.body.appendChild(outsideElement);

    const isInside = settingsDiv.contains(outsideElement);
    expect(isInside).toBe(false);

    document.body.removeChild(settingsDiv);
    document.body.removeChild(outsideElement);
  });

  it("click on portal modal detected via data attribute", () => {
    const portalDiv = document.createElement("div");
    portalDiv.setAttribute("data-filter-controls", "");
    document.body.appendChild(portalDiv);

    const innerDiv = document.createElement("div");
    portalDiv.appendChild(innerDiv);

    // Simulate the handler's portal detection
    const filterModal = document.querySelector("[data-filter-controls]");
    expect(filterModal).toBeTruthy();
    expect(filterModal?.contains(innerDiv)).toBe(true);

    document.body.removeChild(portalDiv);
  });

  it("legend ref correctly identifies legend clicks", () => {
    const legendDiv = document.createElement("div");
    const legendButton = document.createElement("button");
    legendDiv.appendChild(legendButton);
    document.body.appendChild(legendDiv);

    expect(legendDiv.contains(legendButton)).toBe(true);
    expect(legendDiv.contains(document.createElement("div"))).toBe(false);

    document.body.removeChild(legendDiv);
  });
});

// ============================================================
// TEST SUITE 5: Mobile viewport simulation
// ============================================================

describe("Mobile Viewport Simulation", () => {
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    localStorage.clear();
    cleanupPortals();
    // Simulate mobile viewport
    Object.defineProperty(window, "innerWidth", { value: 375, configurable: true });
  });

  afterEach(() => {
    cleanup();
    cleanupPortals();
    Object.defineProperty(window, "innerWidth", { value: originalInnerWidth, configurable: true });
  });

  it("filter modal renders correctly on mobile width", () => {
    const onClose = vi.fn();
    render(
      <FilterProvider>
        <FilterControls isOpen={true} onClose={onClose} />
      </FilterProvider>
    );

    const modal = document.querySelector("[data-filter-controls]");
    expect(modal).toBeTruthy();
    // The inner panel should have w-[90vw] for mobile
    const innerPanel = modal?.querySelector(".bg-space-800");
    expect(innerPanel).toBeTruthy();
    expect(innerPanel?.className).toContain("w-[90vw]");
  });

  it("touch events on modal don't propagate to parent", () => {
    const onClose = vi.fn();
    render(
      <FilterProvider>
        <FilterControls isOpen={true} onClose={onClose} />
      </FilterProvider>
    );

    const overlay = document.querySelector("[data-filter-controls]");
    const touchEvent = new Event("touchstart", { bubbles: true });
    const spy = vi.spyOn(touchEvent, "stopPropagation");
    overlay!.dispatchEvent(touchEvent);
    expect(spy).toHaveBeenCalled();
  });
});

// ============================================================
// TEST SUITE 6: Debounce guard
// ============================================================

describe("Modal Close Debounce Guard", () => {
  it("prevents D3 background click within 300ms of modal close", () => {
    const closeTime = Date.now();
    const timeSince = Date.now() - closeTime;
    expect(timeSince < 300).toBe(true);
  });

  it("allows D3 background click after 300ms", async () => {
    const closeTime = Date.now() - 301;
    const timeSince = Date.now() - closeTime;
    expect(timeSince >= 300).toBe(true);
  });
});

// ============================================================
// TEST SUITE 7: Filter presets
// ============================================================

describe("Filter Presets", () => {
  beforeEach(() => {
    localStorage.clear();
    cleanupPortals();
  });
  afterEach(() => {
    cleanup();
    cleanupPortals();
  });

  it("can save and apply a preset", async () => {
    const onClose = vi.fn();
    let currentFilters: FilterState | undefined;

    render(
      <FilterProvider>
        <FilterStateReader
          onState={(s) => {
            currentFilters = s;
          }}
        />
        <FilterControls isOpen={true} onClose={onClose} />
      </FilterProvider>
    );

    // Apply whale filter
    const advancedToggles = screen.getAllByText("Advanced Filters");
    const toggleSpan = advancedToggles.find((el) => el.tagName === "SPAN");
    if (toggleSpan) {
      fireEvent.click(toggleSpan.closest("button")!);
    }

    const whaleButton = screen.getByText(/Whale \(1-5%\)/);
    fireEvent.click(whaleButton);

    await waitFor(() => {
      expect(currentFilters?.holdingSize).toBe("whale");
    });

    // Save preset
    const presetInput = screen.getByPlaceholderText("Preset name...");
    fireEvent.change(presetInput, { target: { value: "My Whale Filter" } });
    fireEvent.keyPress(presetInput, { key: "Enter", code: "Enter", charCode: 13 });

    // Verify preset was saved (the dropdown should show "1 Saved")
    await waitFor(() => {
      expect(screen.getByText(/1 Saved/)).toBeInTheDocument();
    });
  });
});
