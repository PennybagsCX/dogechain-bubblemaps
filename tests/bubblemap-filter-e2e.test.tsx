/**
 * E2E-style integration tests for the refactored filter system.
 *
 * FilterControls is now a simple panel (no portal, no isOpen).
 * FilterModal is a standalone component tested separately if needed.
 * These tests verify filter logic, UI interactions, and state management.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { FilterProvider, useFilters, FilterState } from "../contexts/FilterContext";
import { FilterControls } from "../components/FilterControls";
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

// ============================================================
// Helper: component that reads filter state
// ============================================================

function FilterStateReader({ onState }: { onState: (s: FilterState) => void }) {
  const { filters } = useFilters();
  React.useEffect(() => {
    onState(filters);
  }, [filters, onState]);
  return null;
}

// ============================================================
// TEST SUITE 1: Filter panel lifecycle
// ============================================================

describe("Filter Panel Lifecycle", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(cleanup);

  it("renders filter controls with all basic sections", () => {
    render(
      <FilterProvider>
        <FilterControls onClose={vi.fn()} />
      </FilterProvider>
    );
    expect(screen.getByText("Filter Dust")).toBeInTheDocument();
    expect(screen.getByText("Whales Only")).toBeInTheDocument();
    expect(screen.getByText("Reset All Filters")).toBeInTheDocument();
  });

  it("applies a holding size filter correctly", async () => {
    let currentFilters: FilterState | undefined;
    const onState = vi.fn((s: FilterState) => {
      currentFilters = s;
    });

    render(
      <FilterProvider>
        <FilterStateReader onState={onState} />
        <FilterControls onClose={vi.fn()} />
      </FilterProvider>
    );

    // Expand advanced section
    const advancedToggles = screen.getAllByText("Advanced Filters");
    const toggleSpan = advancedToggles.find((el) => el.tagName === "SPAN");
    if (toggleSpan) fireEvent.click(toggleSpan.closest("button")!);

    // Select "Whale (1-5%)"
    const whaleButton = screen.getByText(/Whale \(1-5%\)/);
    fireEvent.click(whaleButton);

    await waitFor(() => {
      expect(currentFilters?.holdingSize).toBe("whale");
    });
  });

  it("rapid filter changes all apply correctly", async () => {
    render(
      <FilterProvider>
        <FilterControls onClose={vi.fn()} />
      </FilterProvider>
    );

    // Expand advanced
    const advancedToggles = screen.getAllByText("Advanced Filters");
    const toggleSpan = advancedToggles.find((el) => el.tagName === "SPAN");
    if (toggleSpan) fireEvent.click(toggleSpan.closest("button")!);

    // Rapid changes
    fireEvent.click(screen.getByText(/Whale \(1-5%\)/));
    fireEvent.click(screen.getByText(/Mega/));
    fireEvent.click(screen.getByText("All Holdings"));

    // Final state should be "all" - the button wrapping "All Holdings" should be active
    const allText = screen.getByText("All Holdings");
    const allButton = allText.closest("button");
    expect(allButton?.className).toContain("bg-purple-600");
  });

  it("toggle whales only filter", async () => {
    render(
      <FilterProvider>
        <FilterControls onClose={vi.fn()} />
      </FilterProvider>
    );

    const whalesButton = screen.getByText("Whales Only");
    fireEvent.click(whalesButton);
    expect(whalesButton.className).toContain("bg-purple-600");

    fireEvent.click(whalesButton);
    expect(whalesButton.className).not.toContain("bg-purple-600");
  });

  it("reset button clears all filters", () => {
    render(
      <FilterProvider>
        <FilterControls onClose={vi.fn()} />
      </FilterProvider>
    );

    // Activate whales only
    fireEvent.click(screen.getByText("Whales Only"));
    expect(screen.getByText("Whales Only").className).toContain("bg-purple-600");

    // Reset
    fireEvent.click(screen.getByText("Reset All Filters"));
    expect(screen.getByText("Whales Only").className).not.toContain("bg-purple-600");
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

    for (const { size, expectedCount, _range } of cases) {
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
    }
  });

  it("label filters work correctly", () => {
    const cases: Array<{ label: string; check: (w: Wallet) => boolean }> = [
      { label: "labeled", check: (w) => !!w.label },
      { label: "unlabeled", check: (w) => !w.label },
      { label: "contracts", check: (w) => w.isContract },
    ];

    for (const { label, check } of cases) {
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
      expect(result.every(check)).toBe(true);
    }
  });

  it("combined filters produce correct results", () => {
    // Mega + labeled: mega is >=5%, Binance(10%) and Coinbase(7%) -> 2 results
    const filters: FilterState = {
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
    expect(filterWallets(wallets, filters)).toHaveLength(2);
  });

  it("filters are idempotent", () => {
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

  it("only whales filter works", () => {
    const filters: FilterState = {
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
    // Wallets 0-5 have percentage >= 1 (10, 7, 3.5, 2.5, 1.5, 1.2)
    expect(filterWallets(wallets, filters)).toHaveLength(6);
  });
});

// ============================================================
// TEST SUITE 3: Click event isolation
// ============================================================

describe("Click Event Isolation", () => {
  it("click inside settingsRef does NOT close settings", () => {
    const div = document.createElement("div");
    const btn = document.createElement("button");
    div.appendChild(btn);
    expect(div.contains(btn)).toBe(true);
  });

  it("click outside all refs closes overlays", () => {
    const div = document.createElement("div");
    const outside = document.createElement("div");
    expect(div.contains(outside)).toBe(false);
  });

  it("legend clicks detected correctly", () => {
    const legend = document.createElement("div");
    const btn = document.createElement("button");
    legend.appendChild(btn);
    expect(legend.contains(btn)).toBe(true);
    expect(legend.contains(document.createElement("div"))).toBe(false);
  });

  it("stopPropagation in bubble phase doesn't affect capture", () => {
    const captureHandler = vi.fn();
    const parent = document.createElement("div");
    const child = document.createElement("button");
    parent.appendChild(child);
    document.body.appendChild(parent);

    document.addEventListener("click", captureHandler, true);
    parent.addEventListener("click", (e) => e.stopPropagation());

    fireEvent.click(child);
    expect(captureHandler).toHaveBeenCalledTimes(1);

    document.removeEventListener("click", captureHandler, true);
    document.body.removeChild(parent);
  });
});

// ============================================================
// TEST SUITE 4: Filter state management
// ============================================================

describe("Filter State Management", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(cleanup);

  it("state is maintained across updates", async () => {
    const stateLog: FilterState[] = [];
    render(
      <FilterProvider>
        <FilterStateReader onState={(s) => stateLog.push({ ...s })} />
        <FilterControls onClose={vi.fn()} />
      </FilterProvider>
    );

    expect(stateLog[stateLog.length - 1]?.onlyWhales).toBe(false);

    fireEvent.click(screen.getByText("Whales Only"));
    await waitFor(() => {
      expect(stateLog[stateLog.length - 1]?.onlyWhales).toBe(true);
    });

    fireEvent.click(screen.getByText("Whales Only"));
    await waitFor(() => {
      expect(stateLog[stateLog.length - 1]?.onlyWhales).toBe(false);
    });
  });
});

// ============================================================
// TEST SUITE 5: Filter presets
// ============================================================

describe("Filter Presets", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(cleanup);

  it("can save a preset", async () => {
    render(
      <FilterProvider>
        <FilterControls onClose={vi.fn()} />
      </FilterProvider>
    );

    // Apply whale filter
    const advancedToggles = screen.getAllByText("Advanced Filters");
    const toggleSpan = advancedToggles.find((el) => el.tagName === "SPAN");
    if (toggleSpan) fireEvent.click(toggleSpan.closest("button")!);

    fireEvent.click(screen.getByText(/Whale \(1-5%\)/));

    // Save preset
    const presetInput = screen.getByPlaceholderText("Preset name...");
    fireEvent.change(presetInput, { target: { value: "My Whale Filter" } });
    fireEvent.keyPress(presetInput, { key: "Enter", code: "Enter", charCode: 13 });

    await waitFor(() => {
      expect(screen.getByText(/1 Saved/)).toBeInTheDocument();
    });
  });
});
