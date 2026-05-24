import { describe, it, expect } from "vitest";
import {
  filterWallets,
  getVisibleAndHiddenWallets,
  isWalletVisible,
  getFilterSummary,
  countActiveFilters,
} from "../utils/filterUtils";
import { Wallet } from "../types";
import { FilterState } from "../contexts/FilterContext";

describe("filterUtils", () => {
  const mockWallets: Wallet[] = [
    {
      id: "1",
      address: "0x0000000000000000000000000000000000000001",
      balance: 1000000,
      percentage: 10.0,
      isWhale: true,
      isContract: false,
      label: "Binance",
      connections: [
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10",
        "11",
        "12",
        "13",
        "14",
        "15",
        "16",
        "17",
      ],
    },
    {
      id: "2",
      address: "0x0000000000000000000000000000000000000002",
      balance: 500000,
      percentage: 5.0,
      isWhale: true,
      isContract: false,
      label: "Coinbase",
      connections: ["1", "3"],
    },
    {
      id: "3",
      address: "0x0000000000000000000000000000000000000003",
      balance: 100000,
      percentage: 1.0,
      isWhale: true,
      isContract: false,
      connections: ["1"],
    },
    {
      id: "4",
      address: "0x0000000000000000000000000000000000000004",
      balance: 50000,
      percentage: 0.5,
      isWhale: false,
      isContract: false,
      connections: ["1"],
    },
    {
      id: "5",
      address: "0x0000000000000000000000000000000000000005",
      balance: 10000,
      percentage: 0.1,
      isWhale: false,
      isContract: false,
      connections: ["1"],
    },
    {
      id: "6",
      address: "0x0000000000000000000000000000000000000006",
      balance: 5000,
      percentage: 0.05,
      isWhale: false,
      isContract: false,
      connections: [],
    },
    {
      id: "7",
      address: "0x0000000000000000000000000000000000000007",
      balance: 1000,
      percentage: 0.01,
      isWhale: false,
      isContract: false,
      connections: [],
    },
    {
      id: "8",
      address: "0x0000000000000000000000000000000000000008",
      balance: 500,
      percentage: 0.005,
      isWhale: false,
      isContract: true,
      label: "LP Pool",
      connections: ["1"],
    },
  ];

  const defaultFilters: FilterState = {
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

  describe("filterWallets", () => {
    it("should return all wallets when no filters are applied", () => {
      const result = filterWallets(mockWallets, defaultFilters);
      expect(result).toHaveLength(mockWallets.length);
    });

    it("should filter by holding size - micro", () => {
      const filters: FilterState = { ...defaultFilters, holdingSize: "micro" };
      const result = filterWallets(mockWallets, filters);
      expect(result.every((w) => w.percentage < 0.1)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it("should filter by holding size - retail", () => {
      const filters: FilterState = { ...defaultFilters, holdingSize: "retail" };
      const result = filterWallets(mockWallets, filters);
      expect(result.every((w) => w.percentage >= 0.1 && w.percentage < 1)).toBe(true);
    });

    it("should filter by holding size - whale", () => {
      const filters: FilterState = { ...defaultFilters, holdingSize: "whale" };
      const result = filterWallets(mockWallets, filters);
      expect(result.every((w) => w.percentage >= 1 && w.percentage < 5)).toBe(true);
    });

    it("should filter by holding size - mega", () => {
      const filters: FilterState = { ...defaultFilters, holdingSize: "mega" };
      const result = filterWallets(mockWallets, filters);
      expect(result.every((w) => w.percentage >= 5)).toBe(true);
    });

    it("should filter by label - labeled only", () => {
      const filters: FilterState = { ...defaultFilters, label: "labeled" };
      const result = filterWallets(mockWallets, filters);
      expect(result.every((w) => w.label)).toBe(true);
      expect(result.length).toBe(3);
    });

    it("should filter by label - unlabeled only", () => {
      const filters: FilterState = { ...defaultFilters, label: "unlabeled" };
      const result = filterWallets(mockWallets, filters);
      expect(result.every((w) => !w.label)).toBe(true);
    });

    it("should filter by label - contracts only", () => {
      const filters: FilterState = { ...defaultFilters, label: "contracts" };
      const result = filterWallets(mockWallets, filters);
      expect(result.every((w) => w.isContract)).toBe(true);
      expect(result.length).toBe(1);
    });

    it("should filter by activity - inactive", () => {
      const filters: FilterState = { ...defaultFilters, activity: "inactive" };
      const result = filterWallets(mockWallets, filters);
      expect(result.every((w) => (w.connections?.length || 0) === 0)).toBe(true);
    });

    it("should filter by activity - low", () => {
      const filters: FilterState = { ...defaultFilters, activity: "low" };
      const result = filterWallets(mockWallets, filters);
      expect(
        result.every((w) => {
          const connCount = w.connections?.length || 0;
          return connCount >= 1 && connCount <= 5;
        })
      ).toBe(true);
    });

    it("should filter by activity - medium", () => {
      const filters: FilterState = { ...defaultFilters, activity: "medium" };
      const result = filterWallets(mockWallets, filters);
      expect(
        result.every((w) => {
          const connCount = w.connections?.length || 0;
          return connCount > 5 && connCount <= 15;
        })
      ).toBe(true);
    });

    it("should filter by activity - high", () => {
      const filters: FilterState = { ...defaultFilters, activity: "high" };
      const result = filterWallets(mockWallets, filters);
      expect(result.every((w) => (w.connections?.length || 0) > 15)).toBe(true);
      expect(result.length).toBe(1);
    });

    it("should filter dust when hideDust is true", () => {
      const filters: FilterState = { ...defaultFilters, hideDust: true };
      const result = filterWallets(mockWallets, filters);
      const maxBalance = Math.max(...mockWallets.map((w) => w.balance));
      const threshold = (maxBalance * 0.01) / 100;
      expect(result.every((w) => w.balance >= threshold)).toBe(true);
    });

    it("should filter contracts when hideContracts is true", () => {
      const filters: FilterState = { ...defaultFilters, hideContracts: true };
      const result = filterWallets(mockWallets, filters);
      expect(result.every((w) => !w.isContract)).toBe(true);
      expect(result.length).toBe(mockWallets.length - 1);
    });

    it("should filter whales only when onlyWhales is true", () => {
      const filters: FilterState = { ...defaultFilters, onlyWhales: true };
      const result = filterWallets(mockWallets, filters);
      expect(result.every((w) => w.isWhale || w.percentage >= 1)).toBe(true);
    });

    it("should filter by minBalancePercent", () => {
      const filters: FilterState = { ...defaultFilters, minBalancePercent: 1 };
      const result = filterWallets(mockWallets, filters);
      const maxBalance = Math.max(...mockWallets.map((w) => w.balance));
      const threshold = (maxBalance * 1) / 100;
      expect(result.every((w) => w.balance >= threshold)).toBe(true);
    });

    it("should apply multiple filters together", () => {
      const filters: FilterState = {
        ...defaultFilters,
        holdingSize: "whale",
        label: "labeled",
      };
      const result = filterWallets(mockWallets, filters);
      expect(
        result.every((w) => {
          const isWhaleSize = w.percentage >= 1 && w.percentage < 5;
          const isLabeled = !!w.label;
          return isWhaleSize && isLabeled;
        })
      ).toBe(true);
    });
  });

  describe("getVisibleAndHiddenWallets", () => {
    it("should split wallets into visible and hidden arrays", () => {
      const filters: FilterState = { ...defaultFilters, holdingSize: "whale" };
      const [visible, hidden] = getVisibleAndHiddenWallets(mockWallets, filters);

      expect(visible.length).toBeGreaterThan(0);
      expect(hidden.length).toBeGreaterThan(0);
      expect(visible.length + hidden.length).toBe(mockWallets.length);

      // All visible should be whales
      expect(visible.every((w) => w.percentage >= 1 && w.percentage < 5)).toBe(true);

      // All hidden should not be whales
      expect(hidden.every((w) => w.percentage < 1 || w.percentage >= 5)).toBe(true);
    });

    it("should return all wallets as visible when no filters applied", () => {
      const [visible, hidden] = getVisibleAndHiddenWallets(mockWallets, defaultFilters);

      expect(visible.length).toBe(mockWallets.length);
      expect(hidden.length).toBe(0);
    });
  });

  describe("isWalletVisible", () => {
    it("should return true for visible wallets", () => {
      const filters: FilterState = { ...defaultFilters, holdingSize: "whale" };
      const whaleWallet = mockWallets[2]; // 1.0%
      expect(isWalletVisible(whaleWallet, filters, mockWallets)).toBe(true);
    });

    it("should return false for hidden wallets", () => {
      const filters: FilterState = { ...defaultFilters, holdingSize: "whale" };
      const retailWallet = mockWallets[4]; // 0.1%
      expect(isWalletVisible(retailWallet, filters, mockWallets)).toBe(false);
    });
  });

  describe("getFilterSummary", () => {
    it("should return 'No filters' when no filters are active", () => {
      const summary = getFilterSummary(defaultFilters);
      expect(summary).toBe("No filters");
    });

    it("should include holding size in summary when active", () => {
      const filters: FilterState = { ...defaultFilters, holdingSize: "whale" };
      const summary = getFilterSummary(filters);
      expect(summary).toContain("whale");
    });

    it("should include label filter in summary when active", () => {
      const filters: FilterState = { ...defaultFilters, label: "labeled" };
      const summary = getFilterSummary(filters);
      expect(summary).toContain("labeled");
    });

    it("should include multiple filters in summary", () => {
      const filters: FilterState = {
        ...defaultFilters,
        holdingSize: "whale",
        hideDust: true,
      };
      const summary = getFilterSummary(filters);
      expect(summary).toContain("whale");
      expect(summary).toContain("no dust");
    });
  });

  describe("countActiveFilters", () => {
    it("should return 0 when no filters are active", () => {
      const count = countActiveFilters(defaultFilters);
      expect(count).toBe(0);
    });

    it("should count active filters correctly", () => {
      const filters: FilterState = {
        ...defaultFilters,
        holdingSize: "whale",
        hideDust: true,
        onlyWhales: true,
      };
      const count = countActiveFilters(filters);
      expect(count).toBe(3);
    });

    it("should not count basic display toggles", () => {
      const filters: FilterState = {
        ...defaultFilters,
        showLinks: false,
        showLabels: false,
      };
      const count = countActiveFilters(filters);
      expect(count).toBe(0);
    });
  });
});
